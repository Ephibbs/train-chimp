use serde::{Deserialize, Serialize};
use worker::*;
use uuid::Uuid;
use chrono::Utc;

// Request data structure
#[derive(Deserialize)]
struct FineTuneRequest {
    user_id: String,
    model_name: String,
    description: Option<String>,
    base_model: String,
    dataset_id: String,
    training_params: TrainingParams,
}

#[derive(Deserialize)]
struct TrainingParams {
    epochs: u32,
    batch_size: u32,
    learning_rate: f32,
    lora_rank: Option<u32>,
    lora_alpha: Option<f32>,
    // Add other fine-tuning parameters as needed
}

// Response data structure
#[derive(Serialize)]
struct FineTuneResponse {
    job_id: String,
    model_id: String,
    status: String,
}

// Error response
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[event(fetch)]
async fn main(req: Request, env: Env, ctx: Context) -> Result<Response> {
    Router::new()
        .get("/", |_, _| Response::ok("Hello from TrainChimp Rust Worker!"))
        .get("/health", |_, _| Response::ok("Status: Healthy"))
        .post_async("/fine-tune", |mut req, env| async move {
            handle_fine_tune_request(&mut req, &env).await
        })
        .run(req, env)
        .await
}

async fn handle_fine_tune_request(req: &mut Request, env: &Env) -> Result<Response> {
    // Parse request JSON body
    let fine_tune_req = match req.json::<FineTuneRequest>().await {
        Ok(data) => data,
        Err(e) => {
            return Response::error(format!("Invalid request: {}", e), 400);
        }
    };

    // Get database binding
    let db = match env.d1("trainchimp-db") {
        Ok(db) => db,
        Err(_) => return Response::error("Database connection error", 500),
    };

    // Get R2 binding
    let bucket = match env.r2("my-app-bucket") {
        Ok(bucket) => bucket,
        Err(_) => return Response::error("Storage access error", 500),
    };

    // Get queue binding
    let queue = match env.queue("my-app-queue") {
        Ok(queue) => queue,
        Err(_) => return Response::error("Queue access error", 500),
    };

    // Verify dataset exists and is valid
    if !verify_dataset(&bucket, &fine_tune_req.dataset_id).await {
        return Response::error("Dataset not found or invalid", 404);
    }

    // Generate UUIDs
    let model_id = Uuid::new_v4().to_string();
    let job_id = Uuid::new_v4().to_string();
    let current_time = Utc::now().to_rfc3339();

    // Create model in database
    let model_stmt = format!(
        "INSERT INTO models (id, user_id, name, description, base_model, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );

    match db.prepare(&model_stmt)
        .bind(&[
            model_id.clone().into(),
            fine_tune_req.user_id.into(),
            fine_tune_req.model_name.into(),
            fine_tune_req.description.unwrap_or_default().into(),
            fine_tune_req.base_model.into(),
            "pending".into(),
            current_time.clone().into(),
            current_time.clone().into(),
        ])
        .run()
        .await {
            Ok(_) => (),
            Err(e) => return Response::error(format!("Failed to create model: {}", e), 500),
        };

    // Create job in database
    let job_stmt = format!(
        "INSERT INTO jobs (id, model_id, dataset_id, type, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)",
    );

    match db.prepare(&job_stmt)
        .bind(&[
            job_id.clone().into(),
            model_id.clone().into(),
            fine_tune_req.dataset_id.into(),
            "fine-tune".into(),
            "queued".into(),
            current_time.into(),
        ])
        .run()
        .await {
            Ok(_) => (),
            Err(e) => return Response::error(format!("Failed to create job: {}", e), 500),
        };

    // Create job message
    #[derive(Serialize)]
    struct JobMessage {
        job_id: String,
        model_id: String,
        dataset_id: String,
        base_model: String,
        training_params: TrainingParams,
    }

    let job_message = JobMessage {
        job_id: job_id.clone(),
        model_id: model_id.clone(),
        dataset_id: fine_tune_req.dataset_id,
        base_model: fine_tune_req.base_model,
        training_params: fine_tune_req.training_params,
    };

    // Send to queue
    match queue.send(&serde_json::to_string(&job_message).unwrap()).await {
        Ok(_) => (),
        Err(e) => return Response::error(format!("Failed to queue job: {}", e), 500),
    };

    // Return success response
    let response = FineTuneResponse {
        job_id,
        model_id,
        status: "queued".to_string(),
    };

    Response::from_json(&response)
}

async fn verify_dataset(bucket: &R2Bucket, dataset_id: &str) -> bool {
    // Get dataset info from R2
    let dataset_path = format!("datasets/{}/metadata.json", dataset_id);
    
    match bucket.get(&dataset_path).await {
        Ok(Some(object)) => {
            // Verify that the dataset exists
            // For more comprehensive validation, you could:
            // 1. Check file size
            // 2. Verify data format
            // 3. Count examples
            true
        },
        _ => false,
    }
}

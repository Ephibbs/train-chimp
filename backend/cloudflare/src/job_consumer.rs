use serde::{Deserialize, Serialize};
use worker::*;
use chrono::Utc;

// Define the job message structure that matches what is sent to the queue
#[derive(Deserialize)]
struct JobMessage {
    job_id: String,
    model_id: String,
    dataset_id: String,
    base_model: String,
    training_params: TrainingParams,
}

#[derive(Deserialize)]
struct TrainingParams {
    epochs: u32,
    batch_size: u32,
    learning_rate: f32,
    lora_rank: Option<u32>,
    lora_alpha: Option<f32>,
}

// This function will be called for each batch of messages in the queue
#[event(queue)]
pub async fn queue(batch: MessageBatch<String>, env: Env, ctx: Context) -> Result<()> {
    console_log!("Processing {} messages from queue: {}", batch.messages.len(), batch.queue);
    
    // Get database binding
    let db = match env.d1("DB") {
        Ok(db) => db,
        Err(e) => {
            console_error!("Failed to get database binding: {}", e);
            return Err(Error::from(e));
        }
    };
    
    // Get R2 bucket binding
    let bucket = match env.r2("STORAGE") {
        Ok(bucket) => bucket,
        Err(e) => {
            console_error!("Failed to get R2 bucket binding: {}", e);
            return Err(Error::from(e));
        }
    };
    
    // Process each message in the batch
    for msg in batch.messages.iter() {
        match process_job_message(msg, &db, &bucket).await {
            Ok(_) => {
                console_log!("Successfully processed job {}", msg.id);
            },
            Err(e) => {
                console_error!("Error processing job {}: {}", msg.id, e);
                // Mark message for retry if it failed
                msg.retry().map_err(|e| {
                    console_error!("Failed to mark message for retry: {}", e);
                    Error::from(e)
                })?;
            }
        }
    }
    
    Ok(())
}

async fn process_job_message(msg: &QueueMessage<String>, db: &D1Database, bucket: &R2Bucket) -> Result<()> {
    // Parse the job message
    let job_message = match serde_json::from_str::<JobMessage>(&msg.body) {
        Ok(data) => data,
        Err(e) => {
            return Err(Error::from(format!("Failed to parse job message: {}", e)));
        }
    };
    
    // Update job status to "processing"
    update_job_status(db, &job_message.job_id, "processing").await?;
    
    // Simulate job processing (this would normally be more complex)
    // In a real implementation, you might:
    // 1. Download the dataset from R2
    // 2. Submit the job to a training backend (e.g., AWS Batch, GCP Vertex AI)
    // 3. Poll for completion or set up a webhook
    
    // For this example, we'll simulate successful processing
    console_log!("Processing fine-tuning job {} for model {}", job_message.job_id, job_message.model_id);
    
    // Update model status to "trained" after job completes
    update_model_status(db, &job_message.model_id, "trained").await?;
    
    // Update job status to "completed"
    update_job_status(db, &job_message.job_id, "completed").await?;
    
    // Upload job results (could be metrics, logs, etc.)
    let logs_path = format!("jobs/{}/logs.txt", job_message.job_id);
    let logs_content = format!("Job {} completed successfully at {}", job_message.job_id, Utc::now().to_rfc3339());
    
    // Upload logs to R2
    bucket.put(&logs_path, logs_content.as_bytes()).execute().await?;
    
    // Update job with logs URL
    update_job_logs_url(db, &job_message.job_id, &logs_path).await?;
    
    Ok(())
}

async fn update_job_status(db: &D1Database, job_id: &str, status: &str) -> Result<()> {
    let stmt = format!("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?");
    
    db.prepare(&stmt)
        .bind(&[
            status.into(),
            Utc::now().to_rfc3339().into(),
            job_id.into(),
        ])?
        .run()
        .await?;
    
    Ok(())
}

async fn update_model_status(db: &D1Database, model_id: &str, status: &str) -> Result<()> {
    let stmt = format!("UPDATE models SET status = ?, updated_at = ? WHERE id = ?");
    
    db.prepare(&stmt)
        .bind(&[
            status.into(),
            Utc::now().to_rfc3339().into(),
            model_id.into(),
        ])?
        .run()
        .await?;
    
    Ok(())
}

async fn update_job_logs_url(db: &D1Database, job_id: &str, logs_url: &str) -> Result<()> {
    let stmt = format!("UPDATE jobs SET logs_url = ? WHERE id = ?");
    
    db.prepare(&stmt)
        .bind(&[
            logs_url.into(),
            job_id.into(),
        ])?
        .run()
        .await?;
    
    Ok(())
} 
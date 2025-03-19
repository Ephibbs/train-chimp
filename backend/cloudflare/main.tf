terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }
}

// Provider
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

// Variables
variable "cloudflare_api_token" {
  type        = string
  description = "Your Cloudflare API Token"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Your Cloudflare Account ID"
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Your Cloudflare Zone ID"
}

// Resources

// R2 Bucket
resource "cloudflare_r2_bucket" "trainchimp_bucket" {
  account_id = var.cloudflare_account_id
  name       = "trainchimp-storage"
  location   = "WNAM" # WEUR = Western Europe, ENAM = Eastern North America, etc.
}

// D1 Database
resource "cloudflare_d1_database" "trainchimp_db" {
  account_id = var.cloudflare_account_id
  name       = "trainchimp-db"
}

# Initialize D1 Database schema
resource "cloudflare_d1_database_query" "schema_setup" {
  account_id   = var.cloudflare_account_id
  database_id  = cloudflare_d1_database.trainchimp_db.id

  sql = <<-EOT
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      base_model TEXT NOT NULL,
      lora_adapter_url TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      dataset_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      dataset_id TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      logs_url TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(model_id) REFERENCES models(id),
      FOREIGN KEY(dataset_id) REFERENCES datasets(id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  EOT
}

// Queue
resource "cloudflare_queue" "trainchimp_queue" {
  account_id  = var.cloudflare_account_id
  name        = "trainchimp-jobs-queue"
}

// Worker with proper bindings
resource "cloudflare_workers_script" "rust_worker" {
  account_id = var.cloudflare_account_id
  name       = "trainchimp-worker"
  content    = filebase64("pkg/trainchimp_worker_bg.wasm")
  module     = true
  
  bindings = [
    {
      name = "DB"
      type = "d1_database"
      database_id = cloudflare_d1_database.trainchimp_db.id
    },
    {
      name = "STORAGE"
      type = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.trainchimp_bucket.name
    },
    {
      name = "JOBS_QUEUE"
      type = "queue"
      queue_name = cloudflare_queue.trainchimp_queue.name
    }
  ]
  // R2 Bucket binding
  r2_bucket_binding {
    name       = "STORAGE"
    bucket_name = cloudflare_r2_bucket.trainchimp_bucket.name
  }

  // Queue binding
  queue_binding = [{
    name       = "JOBS_QUEUE"
    queue_name = cloudflare_queue.trainchimp_queue.name
  }]
}

resource "cloudflare_worker_route" "rust_worker_route" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.trainchimp.com/*"
  script_name = cloudflare_worker_script.rust_worker.name
}

// Queue consumer configuration
resource "cloudflare_queue_consumer" "trainchimp_consumer" {
  account_id = var.cloudflare_account_id
  queue_name = cloudflare_queue.trainchimp_queue.name
  script_name = cloudflare_workers_script.rust_worker.name
  settings = {
    max_batch_size = 10
    max_batch_timeout = 30
  }
}

output "r2_bucket_url" {
  value = cloudflare_r2_bucket.trainchimp_bucket.id
}

output "database_id" {
  value = cloudflare_d1_database.trainchimp_db.id
}

output "database_name" {
  value = cloudflare_d1_database.trainchimp_db.name
}

output "queue_id" {
  value = cloudflare_queue.trainchimp_queue.id
}

output "worker_script_name" {
  value = cloudflare_worker_script.rust_worker.name
}

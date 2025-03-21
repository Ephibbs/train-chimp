// First, install the AWS SDK package if needed:
// npm install @aws-sdk/client-ec2

import { EC2Client, RunInstancesCommand, DescribeInstancesCommand, waitUntilInstanceRunning } from "@aws-sdk/client-ec2";

/**
 * Starts an AWS GPU instance based on base model and required GPU memory
 * @param baseModel The name of the base model to use
 * @param requiredGpuMemoryGB The amount of GPU memory required in GB
 * @returns Information about the launched instance
 */
export async function startGpuInstance(
  baseModel: string,
  requiredGpuMemoryGB: number
): Promise<{
  instanceId: string;
  instanceType: string;
  publicDnsName?: string;
  status: string;
}> {
  // Create EC2 client
  const ec2Client = new EC2Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  // Select instance type based on required GPU memory
  const instanceType = selectInstanceType(requiredGpuMemoryGB);

  // Configure instance launch parameters
  const params = {
    ImageId: process.env.AWS_AMI_ID, // AMI with necessary ML software pre-installed
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    KeyName: process.env.AWS_KEY_PAIR_NAME, // SSH key pair name
    SecurityGroupIds: [process.env.AWS_SECURITY_GROUP_ID || ""],
    UserData: Buffer.from(generateUserData(baseModel)).toString("base64"),
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          {
            Key: "Name",
            Value: `GPU-Instance-${baseModel}-${Date.now()}`,
          },
          {
            Key: "Purpose",
            Value: "ML-Training",
          },
        ],
      },
    ],
    BlockDeviceMappings: [
      {
        DeviceName: "/dev/sda1",
        Ebs: {
          VolumeSize: 100, // 100GB storage
          VolumeType: "gp3",
          DeleteOnTermination: true,
        },
      },
    ],
  };

  try {
    // Launch the instance
    const command = new RunInstancesCommand(params);
    const data = await ec2Client.send(command);

    const instance = data.Instances?.[0];
    
    if (!instance || !instance.InstanceId) {
      throw new Error("Failed to launch instance");
    }

    // Wait for the instance to reach running state
    await waitUntilInstanceRunning(
      { client: ec2Client, maxWaitTime: 300 },
      { InstanceIds: [instance.InstanceId] }
    );

    // Get updated instance info (including public DNS)
    const describeCommand = new DescribeInstancesCommand({
      InstanceIds: [instance.InstanceId],
    });
    const describeResult = await ec2Client.send(describeCommand);
    const updatedInstance = describeResult.Reservations?.[0]?.Instances?.[0];

    return {
      instanceId: instance.InstanceId,
      instanceType: instanceType,
      publicDnsName: updatedInstance?.PublicDnsName,
      status: updatedInstance?.State?.Name || "unknown",
    };
  } catch (error) {
    console.error("Error launching GPU instance:", error);
    throw new Error(`Failed to launch GPU instance: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Selects the appropriate EC2 instance type based on required GPU memory
 * @param requiredGpuMemoryGB The amount of GPU memory required in GB
 * @returns The EC2 instance type to use
 */
function selectInstanceType(requiredGpuMemoryGB: number): string {
  // Map of available instance types with their GPU memory (in GB)
  const instanceTypes: Record<string, number> = {
    "g4dn.xlarge": 16,     // 1 NVIDIA T4 with 16GB
    "g4dn.2xlarge": 16,    // 1 NVIDIA T4 with 16GB
    "g4dn.4xlarge": 16,    // 1 NVIDIA T4 with 16GB
    "g4dn.8xlarge": 32,    // 1 NVIDIA T4 with 32GB
    "g4dn.12xlarge": 48,   // 4 NVIDIA T4 with 64GB total
    "g4dn.16xlarge": 64,   // 1 NVIDIA T4 with 64GB
    "p3.2xlarge": 16,      // 1 NVIDIA V100 with 16GB
    "p3.8xlarge": 64,      // 4 NVIDIA V100 with 64GB total
    "p3.16xlarge": 128,    // 8 NVIDIA V100 with 128GB total
    "p4d.24xlarge": 320,   // 8 NVIDIA A100 with 40GB each
    "g5.xlarge": 24,       // 1 NVIDIA A10G with 24GB
    "g5.2xlarge": 24,      // 1 NVIDIA A10G with 24GB
    "g5.4xlarge": 24,      // 1 NVIDIA A10G with 24GB
    "g5.8xlarge": 24,      // 1 NVIDIA A10G with 24GB
    "g5.16xlarge": 48,     // 2 NVIDIA A10G with 48GB total
  };

  // Find suitable instance types that meet the memory requirement
  const suitableInstances = Object.entries(instanceTypes)
    .filter(([, memory]) => memory >= requiredGpuMemoryGB)
    .sort((a, b) => a[1] - b[1]); // Sort by memory (ascending)

  if (suitableInstances.length === 0) {
    throw new Error(`No instance type available for ${requiredGpuMemoryGB}GB GPU memory requirement`);
  }

  // Return the instance type with the lowest suitable memory
  return suitableInstances[0][0];
}

/**
 * Calculate the required GPU memory for a model
 * @param baseModel Name of the base model
 * @param parameters Number of parameters in billions
 * @returns Estimated GPU memory in GB
 */
export function calculateRequiredGpuMemory(baseModel: string, parameters: number): number {
  // Very rough estimation - actual requirements will vary
  // Model size in GB is approximately 2 bytes per parameter for FP16
  const modelSizeGB = (parameters * 1e9 * 2) / 1e9;
  
  // Add overhead for optimizer states, gradients, and other data
  const overhead = 1.5; // 50% overhead
  
  return Math.ceil(modelSizeGB * overhead);
}

/**
 * Generates UserData script to configure the instance on startup
 * @param baseModel The base model to configure
 * @returns A shell script to run on instance startup
 */
function generateUserData(baseModel: string): string {
  return `#!/bin/bash
# TrainChimp startup script
# Set error handling
set -e
trap 'python /home/ec2-user/trainchimp/backend/aws/log_error_and_quit.py "$? $BASH_COMMAND"' ERR

echo "Setting up instance for ${baseModel}" > /home/ec2-user/setup.log
cd /home/ec2-user

echo 'export SUPABASE_URL="${process.env.SUPABASE_URL}"' >> /home/ec2-user/.bashrc
echo 'export SUPABASE_ANON_KEY="${process.env.SUPABASE_ANON_KEY}"' >> /home/ec2-user/.bashrc

# Update system and install dependencies
sudo yum update -y
sudo yum install -y git docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Download and setup training code
git clone https://github.com/ephibbs/trainchimp.git
cd trainchimp

# Create config file for this model
cat > config.json <<EOF
{
  "base_model": "${baseModel}",
  "timestamp": "$(date +%s)"
}
EOF

# Start the training process
./backend/aws/launch_finetuning.sh

echo "Setup complete!" >> /home/ec2-user/setup.log
`;
}

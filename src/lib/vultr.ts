const VULTR_API_KEY = process.env.VULTR_API_KEY!;

export interface VultrInstance {
  id: string;
  os: string;
  ram: number;
  disk: number;
  main_ip: string;
  region: string;
  status: string;
  power_status: string;
  label: string;
  date_created: string;
}

export interface VultrPlan {
  id: string;
  vcpu_count: number;
  ram: number;
  disk: number;
  bandwidth: number;
  monthly_cost: number;
  type: string;
  locations: string[];
}

export async function listInstances(): Promise<VultrInstance[]> {
  const response = await fetch("https://api.vultr.com/v2/instances", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${VULTR_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vultr list instances failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.instances;
}

export async function listPlans(): Promise<VultrPlan[]> {
  const response = await fetch("https://api.vultr.com/v2/plans", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${VULTR_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vultr list plans failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.plans;
}

export async function createInstance(options: {
  region: string;
  plan: string;
  os_id: number;
  label?: string;
  backups?: string;
}) {
  const response = await fetch("https://api.vultr.com/v2/instances", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VULTR_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vultr create instance failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.instance;
}

export async function getInstance(instanceId: string): Promise<VultrInstance> {
  const response = await fetch(`https://api.vultr.com/v2/instances/${instanceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${VULTR_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Vultr get instance failed: ${response.status}`);
  }

  const data = await response.json();
  return data.instance;
}

export async function rebootInstance(instanceId: string) {
  const response = await fetch(`https://api.vultr.com/v2/instances/${instanceId}/reboot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VULTR_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Reboot failed: ${response.status}`);
}

export async function startInstance(instanceId: string) {
  const response = await fetch(`https://api.vultr.com/v2/instances/${instanceId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VULTR_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Start failed: ${response.status}`);
}

export async function stopInstance(instanceId: string) {
  const response = await fetch(`https://api.vultr.com/v2/instances/${instanceId}/halt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VULTR_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Stop failed: ${response.status}`);
}

export async function reinstallInstance(instanceId: string) {
  const response = await fetch(`https://api.vultr.com/v2/instances/${instanceId}/reinstall`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VULTR_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Reinstall failed: ${response.status}`);
}

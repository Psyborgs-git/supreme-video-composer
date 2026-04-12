import type { Asset, Project, RenderJob } from "@studio/shared-types";

export interface CreateProjectInput {
  templateId: string;
  name: string;
  inputProps?: Record<string, unknown>;
  aspectRatio?: string;
}

export interface UpdateProjectInput {
  name?: string;
  inputProps?: Record<string, unknown>;
  aspectRatio?: string;
}

export interface RenderProjectInput {
  codec?: string;
  quality?: string;
}

export interface ListRendersInput {
  projectId?: string;
  status?: string;
}

export interface ListAssetsInput {
  type?: string;
  search?: string;
}

export interface RegisterAssetInput {
  id: string;
  name: string;
  type: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export class StudioApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(getErrorMessage(body) ?? `Studio API request failed with status ${status}`);
  }
}

export class StudioApiClient {
  private readonly baseUrl: string;
  private readonly apiToken?: string;

  constructor(baseUrl: string, apiToken?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    // Support STUDIO_API_TOKEN env var for m2m access
    this.apiToken = apiToken ?? process.env.STUDIO_API_TOKEN;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    return this.request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`);
  }

  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/api/projects");
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/projects/${projectId}`, {
      method: "DELETE",
    });
  }

  async duplicateProject(
    projectId: string,
    input: { name?: string } = {},
  ): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}/duplicate`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async renderProject(projectId: string, input: RenderProjectInput = {}): Promise<RenderJob> {
    return this.request<RenderJob>(`/api/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getRender(jobId: string): Promise<RenderJob> {
    return this.request<RenderJob>(`/api/renders/${jobId}`);
  }

  async listRenders(input: ListRendersInput = {}): Promise<{ jobs: RenderJob[] }> {
    const search = new URLSearchParams();
    if (input.projectId) search.set("projectId", input.projectId);
    if (input.status) search.set("status", input.status);

    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.request<{ jobs: RenderJob[] }>(`/api/renders${suffix}`);
  }

  async cancelRender(jobId: string): Promise<{ success: boolean; jobId: string }> {
    return this.request<{ success: boolean; jobId: string }>(`/api/renders/${jobId}/cancel`, {
      method: "POST",
    });
  }

  async listAssets(input: ListAssetsInput = {}): Promise<{ assets: Asset[] }> {
    const search = new URLSearchParams();
    if (input.type) search.set("type", input.type);
    if (input.search) search.set("search", input.search);

    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.request<{ assets: Asset[] }>(`/api/assets${suffix}`);
  }

  async getAsset(assetId: string): Promise<Asset> {
    return this.request<Asset>(`/api/assets/${assetId}`);
  }

  async deleteAsset(assetId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/assets/${assetId}`, {
      method: "DELETE",
    });
  }

  async registerAsset(input: RegisterAssetInput): Promise<Asset> {
    return this.request<Asset>("/api/assets/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // ─── Billing / Credits ────────────────────────────────────────────────────

  async getCreditBalance(orgSlug: string): Promise<{ plan: string; creditBalance: number }> {
    return this.request<{ plan: string; creditBalance: number }>(`/api/orgs/${orgSlug}/billing`);
  }

  // ─── Automations ──────────────────────────────────────────────────────────

  async listAutomations(orgSlug: string): Promise<{ automations: unknown[] }> {
    return this.request<{ automations: unknown[] }>(`/api/orgs/${orgSlug}/automations`);
  }

  async triggerAutomation(orgSlug: string, automationId: string): Promise<{ run: unknown }> {
    return this.request<{ run: unknown }>(`/api/orgs/${orgSlug}/automations/${automationId}/run`, {
      method: "POST",
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(this.apiToken ? { "X-Api-Token": this.apiToken } : {}),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });

    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      throw new StudioApiError(response.status, body);
    }

    return body as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const error = (body as Record<string, unknown>).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") {
      return (error as Record<string, unknown>).message as string;
    }
  }

  return typeof body === "string" ? body : undefined;
}

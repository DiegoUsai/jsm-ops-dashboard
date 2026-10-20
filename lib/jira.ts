const BASE_URL = () => process.env.JIRA_BASE_URL!;
const AUTH = () =>
  "Basic " + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");

async function jiraGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL()}${path}`, {
    headers: { Authorization: AUTH(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jira API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface JiraSlaValue {
  name: string;
  ongoingCycle?: {
    elapsedTime: { millis: number };
    remainingTime: { millis: number };
    goalDuration: { millis: number };
    breached: boolean;
    paused: boolean;
  };
  completedCycles?: {
    elapsedTime: { millis: number };
    goalDuration: { millis: number };
    breached: boolean;
  }[];
}

export async function fetchTicketSla(issueKey: string): Promise<JiraSlaValue[]> {
  const data = await jiraGet<{ values: JiraSlaValue[] }>(
    `/rest/servicedeskapi/request/${issueKey}/sla`
  );
  return data.values;
}

export interface JiraSearchResult {
  issues: {
    id: string;
    key: string;
    fields: Record<string, unknown>;
  }[];
  total: number;
  startAt: number;
  maxResults: number;
}

export async function searchJql(jql: string, startAt = 0, maxResults = 100): Promise<JiraSearchResult> {
  const params = new URLSearchParams({ jql, startAt: String(startAt), maxResults: String(maxResults) });
  return jiraGet<JiraSearchResult>(`/rest/api/3/search?${params}`);
}

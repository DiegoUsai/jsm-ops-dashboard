const BASE_URL = () => process.env.JIRA_BASE_URL!;
const AUTH = () =>
  "Basic " + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");

async function jiraFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { Authorization: AUTH(), Accept: "application/json", ...options?.headers },
    });
  } catch (err) {
    throw new Error(`Jira fetch failed for ${url.split("?")[0]}: ${err instanceof Error ? err.message : err}`);
  }
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
  const data = await jiraFetch<{ values: JiraSlaValue[] }>(
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
  nextPageToken?: string;
  isLast: boolean;
}

const SEARCH_FIELDS = [
  "summary", "description", "status", "priority", "issuetype", "reporter",
  "assignee", "created", "updated", "resolutiondate", "customfield_10002",
].join(",");

export async function searchJql(jql: string, nextPageToken?: string, maxResults = 100): Promise<JiraSearchResult> {
  const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields: SEARCH_FIELDS });
  if (nextPageToken) params.set("nextPageToken", nextPageToken);
  return jiraFetch<JiraSearchResult>(`/rest/api/3/search/jql?${params}`);
}

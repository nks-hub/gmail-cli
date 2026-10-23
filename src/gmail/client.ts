import { GMAIL_API_BASE } from "../config.ts";
import { GoogleApiClient } from "../google/api.ts";
import type { GmailMessage, SendAs } from "./message.ts";

export type { ApiError } from "../google/api.ts";

/** A lightweight message reference (id + thread id only). */
export interface MessageRef {
  id: string;
  threadId: string;
}

export interface ListMessagesResponse {
  messages?: MessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface Label {
  id: string;
  name: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  labelListVisibility?: string;
  messageListVisibility?: string;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailThread {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
}

export interface Draft {
  id: string;
  message?: GmailMessage;
}

export interface ListDraftsResponse {
  drafts?: Draft[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface AttachmentData {
  size: number;
  /** base64url-encoded attachment bytes. */
  data: string;
}

/**
 * A thin, dependency-free wrapper over the Gmail REST API. All requests are
 * authorized through the injected access-token provider, and transient
 * failures (HTTP 429 and 5xx) are retried with exponential backoff.
 */
export class GmailClient extends GoogleApiClient {
  constructor(opts: {
    getAccessToken: () => Promise<string>;
    fetchFn?: typeof fetch;
  }) {
    super({ baseUrl: GMAIL_API_BASE, apiName: "Gmail API", ...opts });
  }

  /** Returns the signed-in user's Gmail profile. */
  getProfile(): Promise<GmailProfile> {
    return this.request<GmailProfile>("GET", "/users/me/profile");
  }

  /** Lists message references matching the given query. */
  listMessages(opts: {
    query?: string;
    maxResults?: number;
    pageToken?: string;
    labelIds?: string[];
    includeSpamTrash?: boolean;
  } = {}): Promise<ListMessagesResponse> {
    return this.request<ListMessagesResponse>("GET", "/users/me/messages", {
      query: {
        q: opts.query,
        maxResults: opts.maxResults,
        pageToken: opts.pageToken,
        labelIds: opts.labelIds,
        includeSpamTrash: opts.includeSpamTrash,
      },
    });
  }

  /** Fetches a single message in the requested format. */
  getMessage(
    id: string,
    opts: { format?: "full" | "metadata" | "minimal" | "raw"; metadataHeaders?: string[] } = {},
  ): Promise<GmailMessage> {
    return this.request<GmailMessage>("GET", `/users/me/messages/${id}`, {
      query: { format: opts.format, metadataHeaders: opts.metadataHeaders },
    });
  }

  /**
   * Sends a pre-built base64url RFC822 message. `threadId` files a reply into
   * the original conversation; Gmail also needs matching In-Reply-To and
   * References headers and the same subject.
   */
  sendMessage(raw: string, threadId?: string): Promise<GmailMessage> {
    return this.request<GmailMessage>("POST", "/users/me/messages/send", {
      body: threadId ? { raw, threadId } : { raw },
    });
  }

  /** Lists the account's "Send mail as" identities. */
  async listSendAs(): Promise<SendAs[]> {
    const res = await this.request<{ sendAs?: SendAs[] }>(
      "GET",
      "/users/me/settings/sendAs",
    );
    return res.sendAs ?? [];
  }

  /** Adds and/or removes labels on a single message. */
  modifyMessage(
    id: string,
    changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
  ): Promise<GmailMessage> {
    return this.request<GmailMessage>(
      "POST",
      `/users/me/messages/${id}/modify`,
      { body: changes },
    );
  }

  /** Adds and/or removes labels on up to 1000 messages in one call. */
  async batchModify(
    ids: string[],
    changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += 1000) {
      await this.request<void>("POST", "/users/me/messages/batchModify", {
        body: { ids: ids.slice(i, i + 1000), ...changes },
      });
    }
  }

  /** Moves a message to Trash. */
  trashMessage(id: string): Promise<GmailMessage> {
    return this.request<GmailMessage>(
      "POST",
      `/users/me/messages/${id}/trash`,
    );
  }

  /** Returns all labels in the account. */
  async listLabels(): Promise<Label[]> {
    const res = await this.request<{ labels?: Label[] }>(
      "GET",
      "/users/me/labels",
    );
    return res.labels ?? [];
  }

  /** Fetches one label including message counts. */
  getLabel(id: string): Promise<Label> {
    return this.request<Label>("GET", `/users/me/labels/${id}`);
  }

  /** Creates a new user label. */
  createLabel(name: string): Promise<Label> {
    return this.request<Label>("POST", "/users/me/labels", {
      body: {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
  }

  /** Renames an existing label. */
  updateLabel(id: string, name: string): Promise<Label> {
    return this.request<Label>("PUT", `/users/me/labels/${id}`, {
      body: { id, name },
    });
  }

  /** Deletes a label. */
  deleteLabel(id: string): Promise<void> {
    return this.request<void>("DELETE", `/users/me/labels/${id}`);
  }

  /** Fetches a full conversation thread. */
  getThread(
    id: string,
    opts: { format?: "full" | "metadata" | "minimal" } = {},
  ): Promise<GmailThread> {
    return this.request<GmailThread>("GET", `/users/me/threads/${id}`, {
      query: { format: opts.format },
    });
  }

  /** Downloads a message attachment. */
  getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<AttachmentData> {
    return this.request<AttachmentData>(
      "GET",
      `/users/me/messages/${messageId}/attachments/${attachmentId}`,
    );
  }

  /** Lists drafts. */
  listDrafts(opts: { maxResults?: number } = {}): Promise<ListDraftsResponse> {
    return this.request<ListDraftsResponse>("GET", "/users/me/drafts", {
      query: { maxResults: opts.maxResults },
    });
  }

  /** Fetches one draft. */
  getDraft(id: string): Promise<Draft> {
    return this.request<Draft>("GET", `/users/me/drafts/${id}`, {
      query: { format: "full" },
    });
  }

  /** Creates a draft from a pre-built base64url RFC822 message. */
  createDraft(raw: string): Promise<Draft> {
    return this.request<Draft>("POST", "/users/me/drafts", {
      body: { message: { raw } },
    });
  }

  /** Sends an existing draft. */
  sendDraft(id: string): Promise<GmailMessage> {
    return this.request<GmailMessage>("POST", "/users/me/drafts/send", {
      body: { id },
    });
  }

  /** Deletes a draft. */
  deleteDraft(id: string): Promise<void> {
    return this.request<void>("DELETE", `/users/me/drafts/${id}`);
  }
}

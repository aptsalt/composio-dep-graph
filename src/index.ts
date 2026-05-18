import { Composio } from "@composio/core";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ============================================================
// Composio Tool Dependency Graph Builder
// Analyzes Google Super + GitHub toolkits to find precursor
// action dependencies based on required input parameters.
//
// Features:
// - Multi-hop transitive dependency chains
// - Weighted edges (primary vs alternative producers)
// - "Ask user" vs "call tool" distinction
// - Output schema cross-referencing
// - Resource clustering
// ============================================================

const composio = new Composio();

async function fetchTools() {
  if (existsSync("googlesuper_tools.json") && existsSync("github_tools.json")) {
    console.log("Using cached tool definitions...");
    return {
      google: JSON.parse(readFileSync("googlesuper_tools.json", "utf8")),
      github: JSON.parse(readFileSync("github_tools.json", "utf8")),
    };
  }

  console.log("Fetching Google Super tools...");
  const google = await composio.tools.getRawComposioTools({ toolkits: ["googlesuper"], limit: 1000 });
  writeFileSync("googlesuper_tools.json", JSON.stringify(google, null, 2), "utf8");

  console.log("Fetching GitHub tools...");
  const github = await composio.tools.getRawComposioTools({ toolkits: ["github"], limit: 1000 });
  writeFileSync("github_tools.json", JSON.stringify(github, null, 2), "utf8");

  return { google, github };
}

// === Dependency Rules ===
// priority: 1 = primary/natural producer, 2 = alternative, 3 = indirect
type Producer = { slug: RegExp; priority: 1 | 2 | 3; reason: string };
type DepRule = {
  paramMatch: RegExp;
  producers: Producer[];
  toolkit: "googlesuper" | "github";
  resource: string;
  cluster: string;
  userProvidable: boolean; // can user directly provide this?
};

const RULES: DepRule[] = [
  // ======================== GOOGLE: Gmail ========================
  {
    paramMatch: /^thread_id$/, resource: "gmail_thread", toolkit: "googlesuper",
    cluster: "Gmail", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_THREADS$/, priority: 1, reason: "Lists all threads, returns thread IDs" },
      { slug: /^GOOGLESUPER_FETCH_EMAILS$/, priority: 1, reason: "Fetches emails with thread context" },
      { slug: /^GOOGLESUPER_FETCH_MESSAGE_BY_THREAD_ID$/, priority: 3, reason: "Needs thread_id itself (circular for lookup)" },
      { slug: /^GOOGLESUPER_SEND_EMAIL$/, priority: 2, reason: "Returns thread ID of sent message" },
    ],
  },
  {
    paramMatch: /^message_id$/, resource: "gmail_message", toolkit: "googlesuper",
    cluster: "Gmail", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_MESSAGES$/, priority: 1, reason: "Lists messages, returns message IDs" },
      { slug: /^GOOGLESUPER_FETCH_EMAILS$/, priority: 1, reason: "Fetches emails with message IDs" },
      { slug: /^GOOGLESUPER_FETCH_MESSAGE_BY_MESSAGE_ID$/, priority: 3, reason: "Needs message_id itself" },
      { slug: /^GOOGLESUPER_SEND_EMAIL$/, priority: 2, reason: "Returns ID of sent message" },
      { slug: /^GOOGLESUPER_LIST_THREADS$/, priority: 2, reason: "Thread listing includes message IDs" },
    ],
  },
  {
    paramMatch: /^(add_label_ids|remove_label_ids)$/, resource: "gmail_label", toolkit: "googlesuper",
    cluster: "Gmail", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_LABELS$/, priority: 1, reason: "Lists all labels with IDs" },
      { slug: /^GOOGLESUPER_CREATE_LABEL$/, priority: 2, reason: "Returns ID of newly created label" },
      { slug: /^GOOGLESUPER_GET_LABEL$/, priority: 3, reason: "Needs label_id itself" },
    ],
  },
  {
    paramMatch: /^draft_id$/, resource: "gmail_draft", toolkit: "googlesuper",
    cluster: "Gmail", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_DRAFTS$/, priority: 1, reason: "Lists drafts with IDs" },
      { slug: /^GOOGLESUPER_CREATE_EMAIL_DRAFT$/, priority: 1, reason: "Returns draft ID after creation" },
      { slug: /^GOOGLESUPER_GET_DRAFT$/, priority: 3, reason: "Needs draft_id itself" },
    ],
  },
  {
    paramMatch: /^messageIds$/, resource: "gmail_message_batch", toolkit: "googlesuper",
    cluster: "Gmail", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_MESSAGES$/, priority: 1, reason: "Lists messages for batch operations" },
      { slug: /^GOOGLESUPER_FETCH_EMAILS$/, priority: 1, reason: "Fetches emails for batch operations" },
    ],
  },

  // ======================== GOOGLE: Calendar ========================
  {
    paramMatch: /^calendar_id$/, resource: "calendar", toolkit: "googlesuper",
    cluster: "Calendar", userProvidable: true,
    producers: [
      { slug: /^GOOGLESUPER_LIST_CALENDARS$/, priority: 1, reason: "Lists calendars with IDs" },
      { slug: /^GOOGLESUPER_GET_CALENDAR$/, priority: 2, reason: "Gets specific calendar details" },
      { slug: /^GOOGLESUPER_GET_CALENDAR_PROFILE$/, priority: 2, reason: "Returns primary calendar info" },
    ],
  },
  {
    paramMatch: /^calendarId$/, resource: "calendar", toolkit: "googlesuper",
    cluster: "Calendar", userProvidable: true,
    producers: [
      { slug: /^GOOGLESUPER_LIST_CALENDARS$/, priority: 1, reason: "Lists calendars with IDs" },
      { slug: /^GOOGLESUPER_GET_CALENDAR$/, priority: 2, reason: "Gets specific calendar" },
      { slug: /^GOOGLESUPER_GET_CALENDAR_PROFILE$/, priority: 2, reason: "Returns calendar profile" },
    ],
  },
  {
    paramMatch: /^event_id$/, resource: "calendar_event", toolkit: "googlesuper",
    cluster: "Calendar", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_EVENTS_LIST$/, priority: 1, reason: "Lists events with IDs" },
      { slug: /^GOOGLESUPER_EVENTS_LIST_ALL_CALENDARS$/, priority: 1, reason: "Lists events across all calendars" },
      { slug: /^GOOGLESUPER_FIND_EVENT$/, priority: 1, reason: "Searches events by criteria" },
      { slug: /^GOOGLESUPER_CREATE_EVENT$/, priority: 2, reason: "Returns ID of created event" },
      { slug: /^GOOGLESUPER_EVENTS_GET$/, priority: 3, reason: "Needs event_id itself" },
      { slug: /^GOOGLESUPER_SYNC_EVENTS$/, priority: 2, reason: "Syncs events with IDs" },
    ],
  },
  {
    paramMatch: /^eventId$/, resource: "calendar_event", toolkit: "googlesuper",
    cluster: "Calendar", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_EVENTS_LIST$/, priority: 1, reason: "Lists events with IDs" },
      { slug: /^GOOGLESUPER_FIND_EVENT$/, priority: 1, reason: "Finds event by criteria" },
      { slug: /^GOOGLESUPER_CREATE_EVENT$/, priority: 2, reason: "Returns created event ID" },
      { slug: /^GOOGLESUPER_EVENTS_GET$/, priority: 3, reason: "Needs eventId itself" },
    ],
  },
  {
    paramMatch: /^rule_id$/, resource: "acl_rule", toolkit: "googlesuper",
    cluster: "Calendar", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_ACL_LIST$/, priority: 1, reason: "Lists ACL rules" },
      { slug: /^GOOGLESUPER_ACL_INSERT$/, priority: 2, reason: "Returns new rule ID" },
      { slug: /^GOOGLESUPER_ACL_GET$/, priority: 3, reason: "Needs rule_id itself" },
    ],
  },

  // ======================== GOOGLE: Drive ========================
  {
    paramMatch: /^file_id$/, resource: "drive_file", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists Drive files with IDs" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Searches files by name/query" },
      { slug: /^GOOGLESUPER_CREATE_FILE$/, priority: 2, reason: "Returns created file ID" },
      { slug: /^GOOGLESUPER_CREATE_FILE_FROM_TEXT$/, priority: 2, reason: "Returns created file ID" },
      { slug: /^GOOGLESUPER_UPLOAD_FILE$/, priority: 2, reason: "Returns uploaded file ID" },
      { slug: /^GOOGLESUPER_COPY_FILE$/, priority: 2, reason: "Returns copied file ID" },
      { slug: /^GOOGLESUPER_CREATE_GOOGLE_SHEET1$/, priority: 2, reason: "Returns new sheet file ID" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT$/, priority: 2, reason: "Returns new doc file ID" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT2$/, priority: 2, reason: "Returns new doc file ID" },
      { slug: /^GOOGLESUPER_CREATE_PRESENTATION$/, priority: 2, reason: "Returns new slides file ID" },
    ],
  },
  {
    paramMatch: /^fileId$/, resource: "drive_file", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files with IDs" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Searches files" },
      { slug: /^GOOGLESUPER_CREATE_FILE$/, priority: 2, reason: "Returns file ID" },
      { slug: /^GOOGLESUPER_UPLOAD_FILE$/, priority: 2, reason: "Returns file ID" },
      { slug: /^GOOGLESUPER_COPY_FILE$/, priority: 2, reason: "Returns file ID" },
    ],
  },
  {
    paramMatch: /^(folder_id|parent_folder_id)$/, resource: "drive_folder", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists folders (type=folder)" },
      { slug: /^GOOGLESUPER_FIND_FOLDER$/, priority: 1, reason: "Searches folders by name" },
      { slug: /^GOOGLESUPER_CREATE_FOLDER$/, priority: 2, reason: "Returns created folder ID" },
    ],
  },
  {
    paramMatch: /^permission_id$/, resource: "drive_permission", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_PERMISSIONS$/, priority: 1, reason: "Lists file permissions" },
      { slug: /^GOOGLESUPER_CREATE_PERMISSION$/, priority: 2, reason: "Returns permission ID" },
      { slug: /^GOOGLESUPER_ADD_FILE_SHARING_PREFERENCE$/, priority: 2, reason: "Returns permission" },
      { slug: /^GOOGLESUPER_GET_PERMISSION$/, priority: 3, reason: "Needs permission_id" },
    ],
  },
  {
    paramMatch: /^permissionId$/, resource: "drive_permission", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_PERMISSIONS$/, priority: 1, reason: "Lists permissions" },
      { slug: /^GOOGLESUPER_CREATE_PERMISSION$/, priority: 2, reason: "Returns permission ID" },
      { slug: /^GOOGLESUPER_GET_PERMISSION$/, priority: 3, reason: "Needs permissionId" },
    ],
  },
  {
    paramMatch: /^comment_id$/, resource: "drive_comment", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_COMMENTS$/, priority: 1, reason: "Lists comments on file" },
      { slug: /^GOOGLESUPER_CREATE_COMMENT$/, priority: 2, reason: "Returns comment ID" },
      { slug: /^GOOGLESUPER_GET_COMMENT$/, priority: 3, reason: "Needs comment_id" },
    ],
  },
  {
    paramMatch: /^revision_id$/, resource: "drive_revision", toolkit: "googlesuper",
    cluster: "Drive", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_REVISIONS$/, priority: 1, reason: "Lists file revisions" },
      { slug: /^GOOGLESUPER_GET_REVISION$/, priority: 3, reason: "Needs revision_id" },
    ],
  },

  // ======================== GOOGLE: Sheets ========================
  {
    paramMatch: /^spreadsheet_id$/, resource: "spreadsheet", toolkit: "googlesuper",
    cluster: "Sheets", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_SEARCH_SPREADSHEETS$/, priority: 1, reason: "Searches spreadsheets" },
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files (filter by sheets)" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Finds file by name" },
      { slug: /^GOOGLESUPER_CREATE_GOOGLE_SHEET1$/, priority: 2, reason: "Returns new spreadsheet ID" },
      { slug: /^GOOGLESUPER_SHEET_FROM_JSON$/, priority: 2, reason: "Creates sheet from JSON" },
    ],
  },
  {
    paramMatch: /^spreadsheetId$/, resource: "spreadsheet", toolkit: "googlesuper",
    cluster: "Sheets", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_SEARCH_SPREADSHEETS$/, priority: 1, reason: "Searches spreadsheets" },
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Finds file" },
      { slug: /^GOOGLESUPER_CREATE_GOOGLE_SHEET1$/, priority: 2, reason: "Returns spreadsheet ID" },
    ],
  },
  {
    paramMatch: /^(sheet_id|sheetId)$/, resource: "sheet", toolkit: "googlesuper",
    cluster: "Sheets", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_GET_SHEET_NAMES$/, priority: 1, reason: "Lists sheet names/IDs in spreadsheet" },
      { slug: /^GOOGLESUPER_GET_SPREADSHEET_INFO$/, priority: 1, reason: "Returns spreadsheet metadata with sheets" },
      { slug: /^GOOGLESUPER_ADD_SHEET$/, priority: 2, reason: "Returns new sheet ID" },
      { slug: /^GOOGLESUPER_FIND_WORKSHEET_BY_TITLE$/, priority: 1, reason: "Finds sheet by title" },
    ],
  },
  {
    paramMatch: /^sheet_name$/, resource: "sheet", toolkit: "googlesuper",
    cluster: "Sheets", userProvidable: true,
    producers: [
      { slug: /^GOOGLESUPER_GET_SHEET_NAMES$/, priority: 1, reason: "Lists sheet names" },
      { slug: /^GOOGLESUPER_GET_SPREADSHEET_INFO$/, priority: 1, reason: "Returns sheet metadata" },
      { slug: /^GOOGLESUPER_ADD_SHEET$/, priority: 2, reason: "Returns new sheet name" },
    ],
  },
  {
    paramMatch: /^destination_spreadsheet_id$/, resource: "spreadsheet", toolkit: "googlesuper",
    cluster: "Sheets", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_SEARCH_SPREADSHEETS$/, priority: 1, reason: "Searches spreadsheets" },
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files" },
      { slug: /^GOOGLESUPER_CREATE_GOOGLE_SHEET1$/, priority: 2, reason: "Creates new target" },
    ],
  },

  // ======================== GOOGLE: Docs ========================
  {
    paramMatch: /^document_id$/, resource: "document", toolkit: "googlesuper",
    cluster: "Docs", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_SEARCH_DOCUMENTS$/, priority: 1, reason: "Searches documents" },
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files (filter by docs)" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Finds file by name" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT$/, priority: 2, reason: "Returns new doc ID" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT2$/, priority: 2, reason: "Returns new doc ID" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT_MARKDOWN$/, priority: 2, reason: "Creates doc from markdown" },
      { slug: /^GOOGLESUPER_GET_DOCUMENT_BY_ID$/, priority: 3, reason: "Needs document_id" },
    ],
  },
  {
    paramMatch: /^documentId$/, resource: "document", toolkit: "googlesuper",
    cluster: "Docs", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_SEARCH_DOCUMENTS$/, priority: 1, reason: "Searches documents" },
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Finds file" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT$/, priority: 2, reason: "Returns doc ID" },
      { slug: /^GOOGLESUPER_CREATE_DOCUMENT2$/, priority: 2, reason: "Returns doc ID" },
    ],
  },

  // ======================== GOOGLE: Slides ========================
  {
    paramMatch: /^presentationId$/, resource: "presentation", toolkit: "googlesuper",
    cluster: "Slides", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_FILES$/, priority: 1, reason: "Lists files (filter by presentations)" },
      { slug: /^GOOGLESUPER_FIND_FILE$/, priority: 1, reason: "Finds presentation file" },
      { slug: /^GOOGLESUPER_CREATE_PRESENTATION$/, priority: 2, reason: "Returns presentation ID" },
      { slug: /^GOOGLESUPER_CREATE_SLIDES_MARKDOWN$/, priority: 2, reason: "Creates slides from markdown" },
    ],
  },

  // ======================== GOOGLE: Contacts ========================
  {
    paramMatch: /^(recipient_email|email_address)$/, resource: "contact_email", toolkit: "googlesuper",
    cluster: "Contacts", userProvidable: true,
    producers: [
      { slug: /^GOOGLESUPER_GET_CONTACTS$/, priority: 1, reason: "Gets contacts with emails" },
      { slug: /^GOOGLESUPER_SEARCH_PEOPLE$/, priority: 1, reason: "Searches people by name" },
      { slug: /^GOOGLESUPER_GET_PEOPLE$/, priority: 2, reason: "Gets people details" },
    ],
  },

  // ======================== GOOGLE: Photos ========================
  {
    paramMatch: /^albumId$/, resource: "photos_album", toolkit: "googlesuper",
    cluster: "Photos", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_ALBUMS$/, priority: 1, reason: "Lists photo albums" },
      { slug: /^GOOGLESUPER_LIST_SHARED_ALBUMS$/, priority: 1, reason: "Lists shared albums" },
      { slug: /^GOOGLESUPER_CREATE_ALBUM$/, priority: 2, reason: "Returns new album ID" },
      { slug: /^GOOGLESUPER_GET_ALBUM$/, priority: 3, reason: "Needs albumId" },
    ],
  },
  {
    paramMatch: /^mediaItemIds$/, resource: "photos_media", toolkit: "googlesuper",
    cluster: "Photos", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_MEDIA_ITEMS$/, priority: 1, reason: "Lists media items" },
      { slug: /^GOOGLESUPER_SEARCH_MEDIA_ITEMS$/, priority: 1, reason: "Searches media" },
      { slug: /^GOOGLESUPER_BATCH_CREATE_MEDIA_ITEMS$/, priority: 2, reason: "Returns created items" },
    ],
  },

  // ======================== GOOGLE: Tasks ========================
  {
    paramMatch: /^tasklist_id$/, resource: "tasklist", toolkit: "googlesuper",
    cluster: "Tasks", userProvidable: false,
    producers: [
      { slug: /^GOOGLESUPER_LIST_TASK_LISTS$/, priority: 1, reason: "Lists task lists" },
      { slug: /^GOOGLESUPER_CREATE_TASK_LIST$/, priority: 2, reason: "Returns new list ID" },
      { slug: /^GOOGLESUPER_GET_TASK_LIST$/, priority: 3, reason: "Needs tasklist_id" },
    ],
  },

  // ======================== GITHUB: Issues ========================
  {
    paramMatch: /^issue_number$/, resource: "gh_issue", toolkit: "github",
    cluster: "Issues", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORY_ISSUES$/, priority: 1, reason: "Lists repo issues" },
      { slug: /^GITHUB_CREATE_AN_ISSUE$/, priority: 2, reason: "Returns new issue number" },
      { slug: /^GITHUB_SEARCH_ISSUES_AND_PULL_REQUESTS$/, priority: 1, reason: "Searches issues" },
      { slug: /^GITHUB_GET_AN_ISSUE$/, priority: 3, reason: "Needs issue_number" },
    ],
  },

  // ======================== GITHUB: Pull Requests ========================
  {
    paramMatch: /^pull_number$/, resource: "gh_pull_request", toolkit: "github",
    cluster: "Pull Requests", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_PULL_REQUESTS$/, priority: 1, reason: "Lists PRs in repo" },
      { slug: /^GITHUB_CREATE_A_PULL_REQUEST$/, priority: 2, reason: "Returns new PR number" },
      { slug: /^GITHUB_FIND_PULL_REQUESTS$/, priority: 1, reason: "Finds PRs by criteria" },
      { slug: /^GITHUB_SEARCH_ISSUES_AND_PULL_REQUESTS$/, priority: 1, reason: "Searches PRs" },
      { slug: /^GITHUB_GET_A_PULL_REQUEST$/, priority: 3, reason: "Needs pull_number" },
    ],
  },
  {
    paramMatch: /^review_id$/, resource: "gh_review", toolkit: "github",
    cluster: "Pull Requests", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_REVIEWS_FOR_A_PULL_REQUEST$/, priority: 1, reason: "Lists PR reviews" },
      { slug: /^GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST$/, priority: 2, reason: "Returns review ID" },
    ],
  },

  // ======================== GITHUB: Comments ========================
  {
    paramMatch: /^comment_id$/, resource: "gh_comment", toolkit: "github",
    cluster: "Comments", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_ISSUE_COMMENTS$/, priority: 1, reason: "Lists issue comments" },
      { slug: /^GITHUB_LIST_REVIEW_COMMENTS_ON_A_PULL_REQUEST$/, priority: 1, reason: "Lists PR review comments" },
      { slug: /^GITHUB_CREATE_AN_ISSUE_COMMENT$/, priority: 2, reason: "Returns comment ID" },
      { slug: /^GITHUB_CREATE_A_REVIEW_COMMENT_FOR_A_PULL_REQUEST$/, priority: 2, reason: "Returns comment ID" },
      { slug: /^GITHUB_LIST_COMMIT_COMMENTS$/, priority: 1, reason: "Lists commit comments" },
      { slug: /^GITHUB_CREATE_A_COMMIT_COMMENT$/, priority: 2, reason: "Returns comment ID" },
      { slug: /^GITHUB_CREATE_A_GIST_COMMENT$/, priority: 2, reason: "Returns gist comment ID" },
      { slug: /^GITHUB_LIST_GIST_COMMENTS$/, priority: 1, reason: "Lists gist comments" },
      { slug: /^GITHUB_CREATE_A_DISCUSSION_COMMENT$/, priority: 2, reason: "Returns comment ID" },
    ],
  },

  // ======================== GITHUB: Discussions ========================
  {
    paramMatch: /^discussion_number$/, resource: "gh_discussion", toolkit: "github",
    cluster: "Discussions", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_DISCUSSIONS$/, priority: 1, reason: "Lists discussions" },
      { slug: /^GITHUB_CREATE_A_DISCUSSION$/, priority: 2, reason: "Returns discussion number" },
      { slug: /^GITHUB_GET_A_DISCUSSION$/, priority: 3, reason: "Needs discussion_number" },
    ],
  },

  // ======================== GITHUB: Branches & Refs ========================
  {
    paramMatch: /^branch$/, resource: "gh_branch", toolkit: "github",
    cluster: "Git", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_BRANCHES$/, priority: 1, reason: "Lists repo branches" },
      { slug: /^GITHUB_GET_A_BRANCH$/, priority: 3, reason: "Needs branch name" },
    ],
  },
  {
    paramMatch: /^ref$/, resource: "gh_ref", toolkit: "github",
    cluster: "Git", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_MATCHING_REFERENCES$/, priority: 1, reason: "Lists matching refs" },
      { slug: /^GITHUB_CREATE_A_REFERENCE$/, priority: 2, reason: "Returns created ref" },
      { slug: /^GITHUB_LIST_BRANCHES$/, priority: 1, reason: "Branch names are refs" },
      { slug: /^GITHUB_LIST_REPOSITORY_TAGS$/, priority: 1, reason: "Tag names are refs" },
    ],
  },
  {
    paramMatch: /^(commit_sha|tree_sha|sha)$/, resource: "gh_commit", toolkit: "github",
    cluster: "Git", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_COMMITS$/, priority: 1, reason: "Lists commits with SHAs" },
      { slug: /^GITHUB_GET_A_COMMIT$/, priority: 3, reason: "Needs SHA" },
      { slug: /^GITHUB_CREATE_A_COMMIT$/, priority: 2, reason: "Returns commit SHA" },
      { slug: /^GITHUB_CREATE_A_BLOB$/, priority: 2, reason: "Returns blob SHA" },
    ],
  },

  // ======================== GITHUB: Releases ========================
  {
    paramMatch: /^release_id$/, resource: "gh_release", toolkit: "github",
    cluster: "Releases", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_RELEASES$/, priority: 1, reason: "Lists releases" },
      { slug: /^GITHUB_CREATE_A_RELEASE$/, priority: 2, reason: "Returns release ID" },
      { slug: /^GITHUB_GET_THE_LATEST_RELEASE$/, priority: 1, reason: "Gets latest release" },
      { slug: /^GITHUB_GET_A_RELEASE$/, priority: 3, reason: "Needs release_id" },
    ],
  },
  {
    paramMatch: /^asset_id$/, resource: "gh_release_asset", toolkit: "github",
    cluster: "Releases", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_RELEASE_ASSETS$/, priority: 1, reason: "Lists release assets" },
      { slug: /^GITHUB_UPLOAD_A_RELEASE_ASSET$/, priority: 2, reason: "Returns asset ID" },
    ],
  },

  // ======================== GITHUB: CI/CD ========================
  {
    paramMatch: /^workflow_id$/, resource: "gh_workflow", toolkit: "github",
    cluster: "CI/CD", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORY_WORKFLOWS$/, priority: 1, reason: "Lists workflows" },
      { slug: /^GITHUB_GET_A_WORKFLOW$/, priority: 3, reason: "Needs workflow_id" },
    ],
  },
  {
    paramMatch: /^run_id$/, resource: "gh_workflow_run", toolkit: "github",
    cluster: "CI/CD", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_WORKFLOW_RUNS$/, priority: 1, reason: "Lists workflow runs" },
      { slug: /^GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY$/, priority: 1, reason: "Lists all runs for repo" },
      { slug: /^GITHUB_GET_A_WORKFLOW_RUN$/, priority: 3, reason: "Needs run_id" },
    ],
  },
  {
    paramMatch: /^check_run_id$/, resource: "gh_check_run", toolkit: "github",
    cluster: "CI/CD", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_CHECK_RUNS/, priority: 1, reason: "Lists check runs" },
      { slug: /^GITHUB_CREATE_A_CHECK_RUN$/, priority: 2, reason: "Returns check run ID" },
    ],
  },
  {
    paramMatch: /^check_suite_id$/, resource: "gh_check_suite", toolkit: "github",
    cluster: "CI/CD", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_CHECK_SUITES/, priority: 1, reason: "Lists check suites" },
      { slug: /^GITHUB_CREATE_A_CHECK_SUITE$/, priority: 2, reason: "Returns suite ID" },
    ],
  },

  // ======================== GITHUB: Teams & Org ========================
  {
    paramMatch: /^team_slug$/, resource: "gh_team", toolkit: "github",
    cluster: "Org & Teams", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_TEAMS$/, priority: 1, reason: "Lists org teams" },
      { slug: /^GITHUB_CREATE_A_TEAM$/, priority: 2, reason: "Returns team slug" },
      { slug: /^GITHUB_GET_A_TEAM_BY_NAME$/, priority: 3, reason: "Needs team_slug" },
    ],
  },
  {
    paramMatch: /^invitation_id$/, resource: "gh_invitation", toolkit: "github",
    cluster: "Org & Teams", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORY_INVITATIONS$/, priority: 1, reason: "Lists repo invitations" },
      { slug: /^GITHUB_LIST_REPO_INVITATIONS_FOR_AUTH_USER$/, priority: 1, reason: "Lists pending invitations" },
      { slug: /^GITHUB_LIST_PENDING_TEAM_INVITATIONS$/, priority: 1, reason: "Lists team invitations" },
    ],
  },
  {
    paramMatch: /^role_id$/, resource: "gh_role", toolkit: "github",
    cluster: "Org & Teams", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_ALL_CUSTOM_ROLES_FOR_AN_ORGANIZATION$/, priority: 1, reason: "Lists custom roles" },
      { slug: /^GITHUB_CREATE_A_CUSTOM_ORGANIZATION_ROLE$/, priority: 2, reason: "Returns role ID" },
      { slug: /^GITHUB_GET_AN_ORGANIZATION_ROLE$/, priority: 3, reason: "Needs role_id" },
    ],
  },

  // ======================== GITHUB: Deployments ========================
  {
    paramMatch: /^deployment_id$/, resource: "gh_deployment", toolkit: "github",
    cluster: "Deployments", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_DEPLOYMENTS$/, priority: 1, reason: "Lists deployments" },
      { slug: /^GITHUB_CREATE_A_DEPLOYMENT$/, priority: 2, reason: "Returns deployment ID" },
    ],
  },
  {
    paramMatch: /^environment_name$/, resource: "gh_environment", toolkit: "github",
    cluster: "Deployments", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_ENVIRONMENTS$/, priority: 1, reason: "Lists environments" },
      { slug: /^GITHUB_CREATE_OR_UPDATE_AN_ENVIRONMENT$/, priority: 2, reason: "Returns env name" },
      { slug: /^GITHUB_GET_AN_ENVIRONMENT$/, priority: 3, reason: "Needs environment_name" },
    ],
  },

  // ======================== GITHUB: Gists ========================
  {
    paramMatch: /^gist_id$/, resource: "gh_gist", toolkit: "github",
    cluster: "Gists", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_GISTS_FOR_THE_AUTHENTICATED_USER$/, priority: 1, reason: "Lists user gists" },
      { slug: /^GITHUB_CREATE_A_GIST$/, priority: 2, reason: "Returns gist ID" },
      { slug: /^GITHUB_LIST_PUBLIC_GISTS$/, priority: 2, reason: "Lists public gists" },
      { slug: /^GITHUB_LIST_STARRED_GISTS$/, priority: 2, reason: "Lists starred gists" },
      { slug: /^GITHUB_LIST_GISTS_FOR_A_USER$/, priority: 2, reason: "Lists user gists" },
    ],
  },

  // ======================== GITHUB: Projects ========================
  {
    paramMatch: /^project_number$/, resource: "gh_project", toolkit: "github",
    cluster: "Projects", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_USER_PROJECTS$/, priority: 1, reason: "Lists user projects" },
      { slug: /^GITHUB_LIST_ORG_PROJECTS$/, priority: 1, reason: "Lists org projects" },
      { slug: /^GITHUB_CREATE_A_USER_PROJECT$/, priority: 2, reason: "Returns project number" },
      { slug: /^GITHUB_CREATE_AN_ORG_PROJECT$/, priority: 2, reason: "Returns project number" },
    ],
  },
  {
    paramMatch: /^project_id$/, resource: "gh_project_classic", toolkit: "github",
    cluster: "Projects", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORY_PROJECTS$/, priority: 1, reason: "Lists repo projects" },
      { slug: /^GITHUB_LIST_ORGANIZATION_PROJECTS$/, priority: 1, reason: "Lists org projects" },
      { slug: /^GITHUB_CREATE_A_REPOSITORY_PROJECT$/, priority: 2, reason: "Returns project ID" },
      { slug: /^GITHUB_CREATE_AN_ORGANIZATION_PROJECT$/, priority: 2, reason: "Returns project ID" },
    ],
  },

  // ======================== GITHUB: Webhooks & Keys ========================
  {
    paramMatch: /^hook_id$/, resource: "gh_webhook", toolkit: "github",
    cluster: "Config", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORY_WEBHOOKS$/, priority: 1, reason: "Lists repo webhooks" },
      { slug: /^GITHUB_CREATE_A_REPOSITORY_WEBHOOK$/, priority: 2, reason: "Returns hook ID" },
      { slug: /^GITHUB_LIST_ORGANIZATION_WEBHOOKS$/, priority: 1, reason: "Lists org webhooks" },
      { slug: /^GITHUB_CREATE_AN_ORGANIZATION_WEBHOOK$/, priority: 2, reason: "Returns hook ID" },
    ],
  },
  {
    paramMatch: /^key_id$/, resource: "gh_key", toolkit: "github",
    cluster: "Config", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_DEPLOY_KEYS$/, priority: 1, reason: "Lists deploy keys" },
      { slug: /^GITHUB_CREATE_A_DEPLOY_KEY$/, priority: 2, reason: "Returns key ID" },
      { slug: /^GITHUB_LIST_PUBLIC_SSH_KEYS_FOR_THE_AUTHENTICATED_USER$/, priority: 1, reason: "Lists SSH keys" },
    ],
  },

  // ======================== GITHUB: Milestones ========================
  {
    paramMatch: /^milestone_number$/, resource: "gh_milestone", toolkit: "github",
    cluster: "Issues", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_MILESTONES$/, priority: 1, reason: "Lists milestones" },
      { slug: /^GITHUB_CREATE_A_MILESTONE$/, priority: 2, reason: "Returns milestone number" },
    ],
  },

  // ======================== GITHUB: Runners ========================
  {
    paramMatch: /^runner_id$/, resource: "gh_runner", toolkit: "github",
    cluster: "CI/CD", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_SELF_HOSTED_RUNNERS_FOR_A_REPOSITORY$/, priority: 1, reason: "Lists repo runners" },
      { slug: /^GITHUB_LIST_SELF_HOSTED_RUNNERS_FOR_AN_ORGANIZATION$/, priority: 1, reason: "Lists org runners" },
      { slug: /^GITHUB_GET_A_SELF_HOSTED_RUNNER_FOR/, priority: 3, reason: "Needs runner_id" },
    ],
  },

  // ======================== GITHUB: Packages ========================
  {
    paramMatch: /^package_version_id$/, resource: "gh_package_version", toolkit: "github",
    cluster: "Packages", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_PACKAGE_VERSIONS/, priority: 1, reason: "Lists package versions" },
      { slug: /^GITHUB_GET_ALL_PACKAGE_VERSIONS/, priority: 1, reason: "Gets all versions" },
    ],
  },

  // ======================== GITHUB: Codespaces ========================
  {
    paramMatch: /^codespace_name$/, resource: "gh_codespace", toolkit: "github",
    cluster: "Codespaces", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_CODESPACES/, priority: 1, reason: "Lists codespaces" },
      { slug: /^GITHUB_CREATE_A_CODESPACE/, priority: 2, reason: "Returns codespace name" },
      { slug: /^GITHUB_GET_A_CODESPACE/, priority: 3, reason: "Needs codespace_name" },
    ],
  },

  // ======================== GITHUB: Secrets ========================
  {
    paramMatch: /^secret_name$/, resource: "gh_secret", toolkit: "github",
    cluster: "Config", userProvidable: true,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORY_SECRETS$/, priority: 1, reason: "Lists repo secrets" },
      { slug: /^GITHUB_LIST_ORGANIZATION_SECRETS$/, priority: 1, reason: "Lists org secrets" },
      { slug: /^GITHUB_LIST_ENVIRONMENT_SECRETS$/, priority: 1, reason: "Lists env secrets" },
      { slug: /^GITHUB_CREATE_OR_UPDATE.*SECRET$/, priority: 2, reason: "Creates/updates secret" },
    ],
  },

  // ======================== GITHUB: Repository ID ========================
  {
    paramMatch: /^repository_id$/, resource: "gh_repository_id", toolkit: "github",
    cluster: "Repos", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER$/, priority: 1, reason: "Lists user repos" },
      { slug: /^GITHUB_LIST_ORGANIZATION_REPOSITORIES$/, priority: 1, reason: "Lists org repos" },
      { slug: /^GITHUB_SEARCH_REPOSITORIES$/, priority: 1, reason: "Searches repos" },
      { slug: /^GITHUB_GET_A_REPOSITORY$/, priority: 2, reason: "Returns repo with ID" },
    ],
  },

  // ======================== GITHUB: Migrations ========================
  {
    paramMatch: /^migrationId$/, resource: "gh_migration", toolkit: "github",
    cluster: "Config", userProvidable: false,
    producers: [
      { slug: /^GITHUB_LIST_ORGANIZATION_MIGRATIONS$/, priority: 1, reason: "Lists migrations" },
      { slug: /^GITHUB_START_AN_ORGANIZATION_MIGRATION$/, priority: 2, reason: "Returns migration ID" },
      { slug: /^GITHUB_GET_AN_ORGANIZATION_MIGRATION_STATUS$/, priority: 3, reason: "Needs migrationId" },
    ],
  },
];

// === Build Graph ===
function buildGraph(allTools: any[]) {
  type ToolInfo = {
    slug: string;
    toolkit: string;
    description: string;
    requiredParams: string[];
    outputRef: string;
    allInputProps: Record<string, { type: string; description: string }>;
  };

  const tools: ToolInfo[] = allTools.map((t: any) => {
    const props = t.inputParameters?.properties || {};
    const outputRef = t.outputParameters?.properties?.data?.$ref || "";
    const allInputProps: Record<string, { type: string; description: string }> = {};
    for (const [k, v] of Object.entries(props)) {
      const s = v as any;
      allInputProps[k] = { type: s.type || "unknown", description: (s.description || "").substring(0, 200) };
    }
    return {
      slug: t.slug,
      toolkit: t.toolkit?.slug || "unknown",
      description: (t.description || "").substring(0, 300),
      requiredParams: t.inputParameters?.required || [],
      outputRef,
      allInputProps,
    };
  });

  // Build edges with priority and reason
  type Edge = {
    source: string;
    target: string;
    param: string;
    resource: string;
    priority: 1 | 2 | 3;
    reason: string;
    cluster: string;
    userProvidable: boolean;
  };
  const edges: Edge[] = [];

  for (const consumer of tools) {
    for (const paramName of consumer.requiredParams) {
      for (const rule of RULES) {
        if (rule.toolkit !== consumer.toolkit) continue;
        if (!rule.paramMatch.test(paramName)) continue;

        for (const prod of rule.producers) {
          const producers = tools.filter(
            (t) => t.toolkit === rule.toolkit && prod.slug.test(t.slug) && t.slug !== consumer.slug
          );
          for (const p of producers) {
            edges.push({
              source: consumer.slug,
              target: p.slug,
              param: paramName,
              resource: rule.resource,
              priority: prod.priority,
              reason: prod.reason,
              cluster: rule.cluster,
              userProvidable: rule.userProvidable,
            });
          }
        }
        break;
      }
    }
  }

  const uniqueEdges = [...new Map(edges.map((e) => [`${e.source}->${e.target}:${e.param}`, e])).values()];
  const connectedSlugs = new Set([...uniqueEdges.map((e) => e.source), ...uniqueEdges.map((e) => e.target)]);

  // Assign cluster to each node based on its edges
  const nodeCluster = new Map<string, string>();
  for (const e of uniqueEdges) {
    if (!nodeCluster.has(e.source)) nodeCluster.set(e.source, e.cluster);
    if (!nodeCluster.has(e.target)) nodeCluster.set(e.target, e.cluster);
  }

  function categorize(slug: string): string {
    const s = slug.replace(/^(GOOGLESUPER_|GITHUB_)/, "");
    if (/^(LIST|SEARCH|FIND|FETCH|SYNC)/.test(s)) return "retriever";
    if (/^(GET|EVENTS_GET|EVENTS_LIST)/.test(s)) return "getter";
    if (/^(CREATE|ADD|INSERT|UPLOAD|SEND|BATCH_CREATE|QUICK_ADD|SHEET_FROM)/.test(s)) return "creator";
    if (/^(UPDATE|PATCH|EDIT|MODIFY|SET|RENAME|MOVE|BATCH_UPDATE|FORMAT|MERGE|APPROVE)/.test(s)) return "updater";
    if (/^(DELETE|REMOVE|REVOKE|CANCEL|ABORT|TRASH|BATCH_DELETE|DISMISS)/.test(s)) return "deleter";
    return "action";
  }

  // Compute multi-hop chains
  const adjOut = new Map<string, Set<string>>();
  for (const e of uniqueEdges) {
    if (!adjOut.has(e.source)) adjOut.set(e.source, new Set());
    adjOut.get(e.source)!.add(e.target);
  }

  function getTransitiveChain(startSlug: string, maxDepth = 4): string[][] {
    const chains: string[][] = [];
    const visited = new Set<string>();

    function dfs(slug: string, path: string[]) {
      if (path.length > maxDepth) return;
      const neighbors = adjOut.get(slug);
      if (!neighbors || neighbors.size === 0) {
        if (path.length > 1) chains.push([...path]);
        return;
      }
      for (const next of neighbors) {
        if (visited.has(next)) {
          chains.push([...path]); // stop at cycle
          continue;
        }
        visited.add(next);
        dfs(next, [...path, next]);
        visited.delete(next);
      }
    }

    visited.add(startSlug);
    dfs(startSlug, [startSlug]);
    return chains;
  }

  // Build execution plans for interesting tools (those with multi-hop deps)
  const executionPlans: Record<string, { chain: string[]; depth: number }[]> = {};
  for (const slug of connectedSlugs) {
    const chains = getTransitiveChain(slug);
    const multiHop = chains.filter((c) => c.length > 2);
    if (multiHop.length > 0) {
      executionPlans[slug] = multiHop.slice(0, 5).map((c) => ({ chain: c, depth: c.length - 1 }));
    }
  }

  // Output schema cross-reference: check which tools' output refs match input param types
  const outputProducers = new Map<string, string[]>();
  for (const t of tools) {
    if (t.outputRef) {
      // Extract meaningful name from ref like "#/$defs/ListThreadsResponse"
      const refName = t.outputRef.split("/").pop()?.replace("ResponseWrapper", "").replace("Response", "") || "";
      if (refName) {
        if (!outputProducers.has(refName)) outputProducers.set(refName, []);
        outputProducers.get(refName)!.push(t.slug);
      }
    }
  }

  const nodes = tools.filter((t) => connectedSlugs.has(t.slug)).map((t) => ({
    id: t.slug,
    toolkit: t.toolkit,
    category: categorize(t.slug),
    cluster: nodeCluster.get(t.slug) || "Other",
    description: t.description.substring(0, 150),
    requiredParams: t.requiredParams,
  }));

  return {
    nodes,
    edges: uniqueEdges.map((e) => ({
      source: e.source,
      target: e.target,
      param: e.param,
      resource: e.resource,
      priority: e.priority,
      reason: e.reason,
      cluster: e.cluster,
      userProvidable: e.userProvidable,
    })),
    executionPlans,
    metadata: {
      totalTools: allTools.length,
      connectedTools: connectedSlugs.size,
      totalEdges: uniqueEdges.length,
      resources: [...new Set(uniqueEdges.map((e) => e.resource))].length,
      clusters: [...new Set(nodes.map((n) => n.cluster))],
      multiHopTools: Object.keys(executionPlans).length,
      toolkits: ["googlesuper", "github"],
      generatedAt: new Date().toISOString(),
    },
  };
}

// === Main ===
const { google, github } = await fetchTools();
console.log(`Loaded ${google.length} Google Super + ${github.length} GitHub tools`);

const graph = buildGraph([...google, ...github]);
writeFileSync("dependency_graph.json", JSON.stringify(graph, null, 2), "utf8");

console.log(`\nDependency Graph:`);
console.log(`  Nodes: ${graph.nodes.length}`);
console.log(`  Edges: ${graph.edges.length}`);
console.log(`  Resources: ${graph.metadata.resources}`);
console.log(`  Clusters: ${graph.metadata.clusters.join(", ")}`);
console.log(`  Multi-hop tools: ${graph.metadata.multiHopTools}`);

const byResource = new Map<string, number>();
for (const e of graph.edges) byResource.set(e.resource, (byResource.get(e.resource) || 0) + 1);
console.log(`\nBy resource:`);
for (const [r, c] of [...byResource.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${r}: ${c}`);
}

// Show sample execution plans
console.log(`\nSample Execution Plans:`);
const planEntries = Object.entries(graph.executionPlans).slice(0, 5);
for (const [slug, plans] of planEntries) {
  console.log(`  ${slug}:`);
  for (const p of plans.slice(0, 2)) {
    console.log(`    depth=${p.depth}: ${p.chain.join(" -> ")}`);
  }
}

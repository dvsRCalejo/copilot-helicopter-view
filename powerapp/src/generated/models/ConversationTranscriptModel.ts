// TYPE STUB for the Dataverse conversationtranscripts table.
// This file is replaced when you run:
//   pac code add-data-source -a dataverse -t conversationtranscript
// Until then it provides matching TypeScript types so the app compiles.

export interface ConversationTranscript {
  conversationtranscriptid: string;
  name?: string | null;
  createdon: string;
  modifiedon: string;
  content?: string | null;
  schematype?: string | null;
  _bot_botid_value?: string | null;
}

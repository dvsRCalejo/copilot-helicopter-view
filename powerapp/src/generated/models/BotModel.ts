// TYPE STUB for the Dataverse bots table.
// This file is replaced when you run:
//   pac code add-data-source -a dataverse -t bot
// Until then it provides matching TypeScript types so the app compiles.

export interface Bot {
  botid: string;
  name: string;
  statecode: number;
  statuscode: number;
  publishedon?: string | null;
  createdon: string;
  modifiedon: string;
  _owninguser_value?: string | null;
  _ownerid_value?: string | null;
  description?: string | null;
  language?: number;
  runtimeprovider?: number | null;
  schemaname?: string | null;
}

export type AppealDecisionRecord = {
  year?: string;
  appealNumber?: string;
  permitNumber?: string;
  address?: string;
  propertyType?: string;
  propertyUse?: string;
  originalDecision?: string;
  appealFiledDate?: string;
  initialMeetingDate?: string;
  finalSessionDate?: string;
  decisionIssuedDate?: string;
  appealDecision?: string;
};

export type CanliiMetadata = {
  databaseId: string;
  caseId: string;
  url: string;
  title: string;
  citation: string;
  language?: string;
  docketNumber?: string;
  decisionDate?: string;
  keywords?: string;
  concatenatedId?: string;
};

export type CanliiLookupResponse =
  | {
      status: "available";
      metadata: CanliiMetadata;
      cachedAt: string;
      expiresAt: string;
      cached: boolean;
    }
  | {
      status: "not_found" | "not_configured" | "authentication_failed" | "rate_limited" | "unavailable";
      cachedAt?: string;
      expiresAt?: string;
      cached?: boolean;
    };

export type Permit = {
  permitnum?: string;
  address?: string;
  applicant?: string;
  category?: string;
  description?: string;
  proposedusecode?: string;
  proposedusedescription?: string;
  permitteddiscretionary?: string;
  landusedistrict?: string;
  landusedistrictdescription?: string;
  concurrent_loc?: string;
  statuscurrent?: string;
  applieddate?: string;
  decisiondate?: string;
  releasedate?: string;
  mustcommencedate?: string;
  canceledrefuseddate?: string;
  decision?: string;
  decisionby?: string;
  sdabnumber?: string;
  sdabhearingdate?: string;
  sdabdecision?: string;
  sdabdecisiondate?: string;
  appealreporturl?: string;
  appealdecisionrecord?: AppealDecisionRecord;
  communityname?: string;
  ward?: string;
  latitude?: string;
  longitude?: string;
};

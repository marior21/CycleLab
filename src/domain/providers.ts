import type {
  Activity,
  ActivityDetail,
  CoachContext,
  ChatMessage,
  ToolView,
  Usage,
} from "../shared/models";
export interface GarminSource {
  listActivities(offset: number, limit: number): Promise<Activity[]>;
  getActivity(id: string): Promise<ActivityDetail>;
}
export interface CoachProvider {
  respond(
    messages: ChatMessage[],
    context: CoachContext,
    onTool: (tool: ToolView) => void,
    options?: {
      signal?: AbortSignal;
      /** Receives the whole text generated so far. */
      onText?: (text: string) => void;
      onUsage?: (usage: Usage) => void;
      /** Maximum USD for the request. */
      limit?: number | null;
    },
  ): Promise<string>;
}

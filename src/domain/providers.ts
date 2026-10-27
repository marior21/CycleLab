import type {
  Activity,
  ActivityDetail,
  CoachContext,
  ChatMessage,
  ToolView,
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
  ): Promise<string>;
}

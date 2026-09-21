import { Mic } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import VoiceMessageList from "../VoiceMessageList";
import VoiceRecorder from "../VoiceRecorder";

export default function FamilyVoice() {
  const { parentName, voiceMessages, familyMembers } = useGlobalState();
  const primaryMember = (familyMembers || []).find((member) => member.role === "primary");

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)]">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Mic className="size-5 text-teal" aria-hidden="true" />
            Voice messages
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Record a message for {parentName}.
          </p>
          <div className="mt-4">
            <VoiceRecorder from="family" />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <VoiceMessageList
            messages={voiceMessages}
            viewer="family"
            senderNames={{
              parent: parentName,
              family: primaryMember?.name || "Family",
            }}
          />
        </div>
      </div>
    </section>
  );
}

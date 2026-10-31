import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { SolarBotMascot } from "./SolarBotMascot";
import { SolarBotSpeechBubble } from "./SolarBotSpeechBubble";
import { SolarBotChatPanel } from "./SolarBotChatPanel";

export function SolarBotWidget() {
  const session = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);

  // Check if speech bubble was dismissed previously
  useEffect(() => {
    const dismissed = localStorage.getItem("solarbot_dismissed_welcome");
    if (!dismissed) {
      // Delay presentation slightly so page settles
      const timer = window.setTimeout(() => {
        setShowSpeechBubble(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleOpenChat = () => {
    setIsOpen(true);
    setShowSpeechBubble(false);
  };

  const handleCloseChat = () => {
    setIsOpen(false);
  };

  const handleDismissBubble = () => {
    setShowSpeechBubble(false);
    localStorage.setItem("solarbot_dismissed_welcome", "true");
  };

  const sessionInfo = session
    ? {
        isLoggedIn: true,
        role: session.role,
        name: session.name,
        email: session.email,
        customerId: session.customerId,
      }
    : {
        isLoggedIn: false,
      };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-none">
      {/* 1. Welcome Speech Bubble */}
      {showSpeechBubble && !isOpen && (
        <SolarBotSpeechBubble
          onOpenChat={handleOpenChat}
          onDismiss={handleDismissBubble}
        />
      )}

      {/* 2. Chat Panel */}
      <div className="pointer-events-auto">
        <SolarBotChatPanel
          isOpen={isOpen}
          onClose={handleCloseChat}
          onMinimize={handleCloseChat}
          session={sessionInfo}
        />
      </div>

      {/* 3. Floating 3D Robot Mascot */}
      {!isOpen && (
        <div className="pointer-events-auto mt-1">
          <SolarBotMascot
            onClick={handleOpenChat}
            isOpen={isOpen}
            hasUnread={showSpeechBubble}
          />
        </div>
      )}
    </div>
  );
}

import { ParticleTextEffect } from "@/components/ui/particle-text-effect";
import { GlobalMuteButton } from "@/components/GlobalMuteButton";
import { GlobalSiteSearch } from "@/components/GlobalSiteSearch";
import { GlobalHelpRequest } from "@/components/GlobalHelpRequest";

export function SiteChrome() {
  return (
    <>
      <ParticleTextEffect />
      <GlobalSiteSearch />
      <GlobalHelpRequest />
      <GlobalMuteButton />
    </>
  );
}

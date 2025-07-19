import { WelcomePage } from "@/components/welcome/welcome-page";
import { WelcomeLayout } from "@/components/layout/welcome-layout";

export default function Home() {
  return (
    <WelcomeLayout>
      <WelcomePage />
    </WelcomeLayout>
  );
}

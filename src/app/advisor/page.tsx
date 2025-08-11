import AdvisorChat from "../../components/AdvisorChat";
import programs from "../../data/programs.sample";

export default function AdvisorPage() {
  return <AdvisorChat initialPrograms={programs} />;
}
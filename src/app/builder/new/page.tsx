import { Builder } from "../../../components/builder/builder";
import { getCurrentUserId } from "../../../lib/auth/current-user";

export default async function NewBuilderPage() { return <Builder canCloudSave={!!(await getCurrentUserId())} />; }

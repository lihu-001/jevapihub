import { Builder } from "../../components/builder/builder";
import { getCurrentUserId } from "../../lib/auth/current-user";

export default async function PlaygroundPage() { return <Builder canCloudSave={!!(await getCurrentUserId())} />; }

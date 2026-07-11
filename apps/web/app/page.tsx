import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { AppShellLayout } from "@/components/app-shell";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
	await requireAuth();

	return (
		<AppShellLayout>
			<Stack gap="xs">
				<Text size="xs" tt="uppercase" fw={700} c="dimmed">Workspace</Text>
				<Title order={2}>Oriskin Task Management</Title>
				<Text c="dimmed">The operational workspace is ready for the task-management modules.</Text>
			</Stack>
			<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
				<Card withBorder><Title order={4}>Projects</Title><Text c="dimmed" size="sm">No projects configured yet.</Text></Card>
				<Card withBorder><Title order={4}>Weekly Plan</Title><Text c="dimmed" size="sm">No planning period is active yet.</Text></Card>
				<Card withBorder><Title order={4}>Approvals</Title><Text c="dimmed" size="sm">No approvals are waiting.</Text></Card>
			</SimpleGrid>
		</AppShellLayout>
	);
}

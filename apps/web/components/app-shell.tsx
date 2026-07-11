"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, Burger, Button, Group, NavLink, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useState } from "react";

const navItems = [{ href: "/", label: "Workspace", icon: LayoutDashboard }] as const;

export function AppShellLayout({ children }: { children: React.ReactNode }) {
	const [opened, setOpened] = useState(false);
	const pathname = usePathname();
	const router = useRouter();

	async function logout() {
		await fetch("/nextapi/auth/logout", { method: "POST" });
		router.refresh();
	}

	return (
		<AppShell
			header={{ height: 64 }}
			navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened, desktop: false } }}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between" wrap="nowrap">
					<Group gap="sm" wrap="nowrap">
						<Burger opened={opened} onClick={() => setOpened((value) => !value)} hiddenFrom="sm" size="sm" />
						<Image src="/images/app-logo.png" alt="Oriskin Task Management" width={32} height={32} priority />
						<div>
							<Text size="xs" fw={700} tt="uppercase" c="dimmed">Oriskin</Text>
							<Title order={4}>Task Management</Title>
						</div>
					</Group>
					<Button variant="default" size="xs" leftSection={<LogOut size={14} />} onClick={logout}>
						Logout
					</Button>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md" bg="var(--app-sidebar)">
				<Stack gap="xs">
					{navItems.map((item) => {
						const Icon = item.icon;
						return (
							<NavLink
								key={item.href}
								component={Link}
								href={item.href}
								label={item.label}
								active={pathname === item.href}
								leftSection={<Icon size={16} />}
								onClick={() => setOpened(false)}
							/>
						);
					})}
				</Stack>
			</AppShell.Navbar>

			<AppShell.Main>
				<ScrollArea type="never">
					<Stack gap="lg" maw={1280} mx="auto">{children}</Stack>
				</ScrollArea>
			</AppShell.Main>
		</AppShell>
	);
}

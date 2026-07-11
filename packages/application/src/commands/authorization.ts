export type CommandRole = "member" | "lead" | "manager" | "head_it" | "admin";
export type CommandAction = "submit" | "approve" | "edit" | "complete";

export class CommandAuthorizationError extends Error {
	readonly code = "COMMAND_UNAUTHORIZED" as const;

	constructor(role: CommandRole, action: CommandAction) {
		super(`Role ${role} cannot execute command ${action}`);
		this.name = "CommandAuthorizationError";
	}
}

const allowedActions: Record<CommandRole, readonly CommandAction[]> = {
	member: ["submit"],
	lead: ["submit", "approve", "edit", "complete"],
	manager: ["submit", "approve"],
	head_it: ["submit", "approve"],
	admin: ["submit", "approve"],
};

export function assertCanExecuteCommand(role: CommandRole, action: CommandAction): void {
	if (!allowedActions[role].includes(action)) {
		throw new CommandAuthorizationError(role, action);
	}
}

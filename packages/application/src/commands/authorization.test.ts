import { describe, expect, test } from "bun:test";

import {
	assertCanExecuteCommand,
	CommandAuthorizationError,
} from "./authorization";

describe("command authorization", () => {
	test("allows the approved role actions", () => {
		expect(() => assertCanExecuteCommand("member", "submit")).not.toThrow();
		expect(() => assertCanExecuteCommand("lead", "complete")).not.toThrow();
		expect(() => assertCanExecuteCommand("manager", "approve")).not.toThrow();
		expect(() => assertCanExecuteCommand("head_it", "approve")).not.toThrow();
	});

	test("restricts active-work changes to lead", () => {
		expect(() => assertCanExecuteCommand("member", "complete")).toThrow(CommandAuthorizationError);
		expect(() => assertCanExecuteCommand("manager", "edit")).toThrow(CommandAuthorizationError);
		expect(() => assertCanExecuteCommand("head_it", "complete")).toThrow(CommandAuthorizationError);
	});
});

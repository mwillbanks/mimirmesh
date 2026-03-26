const baseTemplate = `---
name: {{name}}
description: {{description}}
license: Apache-2.0
---

# {{title}}

## Purpose
- {{purpose}}

## When to Use
- {{whenToUse}}

## Required Inputs
- {{requiredInputs}}

## Outputs
- {{outputs}}

## Steps
- {{steps}}

## Avoid
- {{avoid}}
`;

export const skillTemplateCatalog = {
	default: baseTemplate,
} as const;

export const renderSkillTemplate = (input: {
	name: string;
	description: string;
	prompt: string;
	template?: string;
}): string => {
	const template = input.template ?? skillTemplateCatalog.default;
	return template
		.replaceAll("{{name}}", input.name)
		.replaceAll("{{title}}", input.name.replaceAll("-", " "))
		.replaceAll("{{description}}", input.description)
		.replaceAll("{{purpose}}", input.prompt)
		.replaceAll("{{whenToUse}}", `Use when the task matches: ${input.prompt}`)
		.replaceAll("{{requiredInputs}}", "Problem statement")
		.replaceAll("{{outputs}}", "Concrete implementation guidance")
		.replaceAll("{{steps}}", "Inspect existing code before editing")
		.replaceAll("{{avoid}}", "Speculative changes detached from repository patterns");
};

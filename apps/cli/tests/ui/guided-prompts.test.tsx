import { describe, expect, test } from "bun:test";
import { GuidedMultiSelect, GuidedTextInput } from "@mimirmesh/ui";
import { useState } from "react";

import { renderInkInteraction, renderInkStatic } from "../../src/testing/render-ink";

describe("guided prompts", () => {
	test("renders multi-select choices with the same checkbox treatment as single-select prompts", () => {
		const output = renderInkStatic(
			<GuidedMultiSelect
				title="Choose install areas"
				reason="Review the areas."
				consequence="The selected areas will be installed."
				nonInteractiveFallback="mimirmesh install --non-interactive --preset recommended --areas core,skills"
				choices={[
					{
						label: "Core repository install",
						value: "core",
						description: "Install the core repository setup.",
						recommended: true,
					},
					{
						label: "IDE integration",
						value: "ide",
						description: "Install IDE configuration.",
					},
				]}
				defaultValues={["core"]}
				onSubmit={() => undefined}
			/>,
		);

		expect(output).toContain("[x] Core repository install (recommended)");
		expect(output).toContain("[ ] IDE integration");
	});

	test("resets text input state when the next prompt has a different initial value", async () => {
		const Stepper = () => {
			const [step, setStep] = useState<"baseUrl" | "model">("baseUrl");

			if (step === "baseUrl") {
				return (
					<GuidedTextInput
						title="Enter the LM Studio base URL"
						reason="Need the endpoint."
						consequence="Persist the URL."
						nonInteractiveFallback="mimirmesh install --non-interactive --embeddings existing-lm-studio --embeddings-base-url http://localhost:1234/v1"
						label="LM Studio base URL"
						initialValue="http://localhost:1234/v1"
						onSubmit={() => {
							setStep("model");
						}}
					/>
				);
			}

			return (
				<GuidedTextInput
					title="Enter the LM Studio embeddings model"
					reason="Need the model."
					consequence="Persist the model."
					nonInteractiveFallback="mimirmesh install --non-interactive --embeddings existing-lm-studio --embeddings-model text-embedding-nomic-embed-text-v1.5"
					label="LM Studio model"
					initialValue="text-embedding-nomic-embed-text-v1.5"
					onSubmit={() => undefined}
				/>
			);
		};

		const output = await renderInkInteraction(<Stepper />, async ({ stdin, wait }) => {
			stdin.write("\r");
			await wait();
		});

		expect(output).toContain("LM Studio model: text-embedding-nomic-embed-text-v1.5");
		expect(output).not.toContain("LM Studio model: http://localhost:1234/v1");
	});
});

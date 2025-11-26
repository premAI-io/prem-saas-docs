#!/usr/bin/env node

/**
 * Fetches model data from the Prem API and generates the available-models.mdx file
 * Run with: node scripts/generate-models.mjs
 */

const API_URL = 'https://studio.premai.io/api/public/publicModels';
const OUTPUT_PATH = new URL('../resources/available-models.mdx', import.meta.url);

async function fetchModels() {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }
  return response.json();
}

function formatPrice(price) {
  if (price === null || price === undefined) return '-';
  if (price === 0) return 'Free';
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 0.1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function formatTokens(tokens) {
  if (tokens === null || tokens === undefined) return '-';
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`;
  }
  return tokens.toString();
}

function formatParameters(paramCount) {
  if (paramCount === null || paramCount === undefined) return null;
  if (paramCount < 1) {
    return `${(paramCount * 1000).toFixed(0)}M`;
  }
  return `${paramCount}B`;
}

// Default icon for groups without a specific icon
const DEFAULT_ICON = '/images/model-icons/hf.png';

// Get group icon for section header
function getGroupIcon(group) {
  const icons = {
    'claude': '/images/model-icons/anthropic.webp',
    'gpt': '/images/model-icons/openai.svg',
    'gpt-oss': '/images/model-icons/openai.svg',
    'llama': '/images/model-icons/meta.png',
    'qwen': '/images/model-icons/qwen.png',
    'gemma': '/images/model-icons/google.png',
    'mistral': '/images/model-icons/mistralai.png',
    'deepseek': '/images/model-icons/deepseek.png',
    'phi': '/images/model-icons/microsoft.png',
    'nova': '/images/model-icons/nova.png',
    'ibm': '/images/model-icons/ibm.png',
    'nvidia': '/images/model-icons/nvidia.svg',
    'glm': '/images/model-icons/z_ai.svg',
  };
  return icons[group.toLowerCase()] || DEFAULT_ICON;
}

function generateModelCard(model) {
  const name = model.alias || model.id;
  const params = formatParameters(model.parameter_count);

  // Build colored capability badges using CSS classes from custom.css
  const badges = [];
  if (model.finetuning) {
    badges.push('<span class="models-badge-purple">Fine-tunable</span>');
  }
  if (model.supportsJsonOutput) {
    badges.push('<span class="models-badge-blue">JSON</span>');
  }
  if (model.supportsFunctionCalling) {
    badges.push('<span class="models-badge-green">Tools</span>');
  }

  const badgesLine = badges.length > 0 ? badges.join('') : '';
  const paramsLine = params ? ` · ${params}` : '';

  return `<Card title="${name}">
<div class="models-card-tokens">${formatTokens(model.maxCompletionTokens)} max tokens${paramsLine}</div>
<div class="models-card-pricing">

| Input | Output |
|:--|:--|
| ${formatPrice(model.inputPricePer1MTokens)}/1M | ${formatPrice(model.outputPricePer1MTokens)}/1M |
</div>
${badgesLine}
</Card>`;
}

function groupModels(models) {
  const grouped = {};
  for (const model of models) {
    const group = model.group || 'other';
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(model);
  }

  // Sort models within each group by alias
  for (const group of Object.keys(grouped)) {
    grouped[group].sort((a, b) => (a.alias || '').localeCompare(b.alias || ''));
  }

  return grouped;
}

function getSortedGroups(groupedModels) {
  return Object.keys(groupedModels).sort((a, b) => a.localeCompare(b));
}

function capitalizeGroup(group) {
  // Special cases for acronyms
  const specialCases = {
    'gpt': 'GPT',
    'gpt-oss': 'GPT-OSS',
    'ibm': 'IBM',
    'nvidia': 'NVIDIA',
    'glm': 'GLM',
    'smollm2': 'SmolLM2',
  };

  if (specialCases[group.toLowerCase()]) {
    return specialCases[group.toLowerCase()];
  }

  return group.charAt(0).toUpperCase() + group.slice(1);
}

function generateGroupSection(groupName, models) {
  const title = capitalizeGroup(groupName);
  const icon = getGroupIcon(groupName);
  const modelCount = models.length;

  let section = `
<div class="models-group-header">
  <img src="${icon}" alt="${title}" class="models-group-icon" />
  <span class="models-group-title">${title} (${modelCount})</span>
</div>
<CardGroup cols={2}>
`;

  for (const model of models) {
    section += generateModelCard(model) + '\n';
  }

  section += `</CardGroup>
`;

  return section;
}

function generateMdx(models) {
  // Separate finetunable and all models
  const finetunableModels = models.filter(m => m.finetuning);
  const allModels = [...models];

  // Group both sets
  const finetunableGrouped = groupModels(finetunableModels);
  const allGrouped = groupModels(allModels);

  const finetunableSortedGroups = getSortedGroups(finetunableGrouped);
  const allSortedGroups = getSortedGroups(allGrouped);

  let mdx = `---
title: Available Models
icon: microchip
---

{/* This file is auto-generated by scripts/generate-models.mjs - Do not edit manually */}

Prem provides access to a wide range of AI models through various providers. Browse our available models below.

<Info>
**Pricing** is shown per 1 million tokens. Models with the \`Fine-tunable\` badge can be customized with your own data through Prem's fine-tuning platform.
</Info>

## Capability Legend

| Badge | Description |
|-------|-------------|
| \`Fine-tunable\` | Can be fine-tuned with your own data on Prem |
| \`JSON\` | Supports structured JSON output mode |
| \`Tools\` | Supports function calling and tool use |

<Tabs>
  <Tab title="Fine-tunable Models (${finetunableModels.length})">

These models can be fine-tuned on Prem's platform with your own data.

`;

  // Generate finetunable models sections
  for (const group of finetunableSortedGroups) {
    mdx += generateGroupSection(group, finetunableGrouped[group]);
  }

  mdx += `
  </Tab>
  <Tab title="All Models (${allModels.length})">

Complete catalog of all models available on Prem.

`;

  // Generate all models sections
  for (const group of allSortedGroups) {
    mdx += generateGroupSection(group, allGrouped[group]);
  }

  mdx += `
  </Tab>
</Tabs>
`;

  return mdx;
}

async function main() {
  console.log('Fetching models from API...');
  const models = await fetchModels();
  console.log(`Fetched ${models.length} models`);

  const finetunableCount = models.filter(m => m.finetuning).length;
  console.log(`${finetunableCount} models are fine-tunable`);

  console.log('Generating MDX...');
  const mdx = generateMdx(models);

  const fs = await import('fs');
  const { fileURLToPath } = await import('url');
  const outputPath = fileURLToPath(OUTPUT_PATH);

  fs.writeFileSync(outputPath, mdx);
  console.log(`Written to ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

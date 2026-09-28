/**
 * 設計展示櫃的內容（SPEC-design-showcase，2026-07-28 拍板架構；2026-08-08 首版陳列）。
 *
 * 每一項四個欄位：元素名、決定的值、理念標籤＋推導、（可選）示範。
 * **推導只陳列本人拍板過的，AI 不得補寫**（規格明文）——盤點輪還沒結案的維度
 * 用 `pending: true` 掛對外語氣的狀態標示，不硬編理由。
 * 理念標籤對應 AI#1 頁的五大共同理念，站上語彙，不用 UI/UX 術語。
 */

import { t } from './text.mjs';

export const DESIGN_CATEGORIES = [
	{
		key: 'color',
		label: t('design.color.label'),
		items: [
			{
				name: t('design.color.1.name'),
				value: t('design.color.1.value'),
				why: [
					{ idea: t('idea.personal'), text: t('design.color.1.why1') },
					{ idea: t('idea.lowkey'), text: t('design.color.1.why2') },
				],
				demo: 'strips',
				strips: [
					{ v: 'var(--color-bg)', t: t('design.color.1.strip1') },
					{ v: 'var(--color-bloom-dark)', t: t('design.color.1.strip2') },
					{ v: 'var(--color-bg-card)', t: t('design.color.1.strip3') },
				],
				links: [{ href: '/process/why-mist-purple.html', label: t('design.color.1.link1') }],
			},
			{
				name: t('design.color.2.name'),
				value: t('design.color.2.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.color.2.why1') },
				],
				demo: 'strips',
				strips: [
					{ v: 'var(--color-accent)', t: t('design.color.2.strip1') },
					{ v: 'var(--color-ask)', t: t('design.color.2.strip2') },
				],
			},
			{
				name: t('design.color.3.name'),
				value: t('design.color.3.value'),
				why: [
					{ idea: t('idea.lowkey'), text: t('design.color.3.why1') },
				],
				demo: 'ramp',
			},
			{
				name: t('design.color.4.name'),
				value: t('design.color.4.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.color.4.why1') },
				],
			},
		],
	},
	{
		key: 'type',
		label: t('design.type.label'),
		items: [
			{
				name: t('design.type.1.name'),
				value: t('design.type.1.value'),
				demo: 'spec-display',
				why: [
					{ idea: t('idea.personal'), text: t('design.type.1.why1') },
				],
			},
			{
				name: t('design.type.2.name'),
				value: t('design.type.2.value'),
				demo: 'spec-body',
				why: [
					{ idea: t('idea.personal'), text: t('design.type.2.why1') },
				],
			},
			{
				name: t('design.type.3.name'),
				value: t('design.type.3.value'),
				demo: 'ladder',
				why: [
					{ idea: t('idea.readable'), text: t('design.type.3.why1') },
				],
			},
			{
				name: t('design.type.4.name'),
				value: t('design.type.4.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.type.4.why1') },
				],
			},
			{
				name: t('design.type.5.name'),
				value: t('design.type.5.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.type.5.why1') },
				],
			},
			{
				name: t('design.type.6.name'),
				value: t('design.type.6.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.type.6.why1') },
				],
			},
		],
	},
	{
		key: 'spacing',
		label: t('design.spacing.label'),
		items: [
			{
				name: t('design.spacing.1.name'),
				value: t('design.spacing.1.value'),
				demo: 'baseline',
				why: [
					{ idea: t('idea.lowkey'), text: t('design.spacing.1.why1') },
				],
			},
			{
				name: t('design.spacing.2.name'),
				value: t('design.spacing.2.value'),
				demo: 'gaps',
				why: [
					{ idea: t('idea.restrained'), text: t('design.spacing.2.why1') },
				],
			},
			{
				name: t('design.spacing.3.name'),
				value: t('design.spacing.3.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.spacing.3.why1') },
				],
			},
			{
				name: t('design.spacing.4.name'),
				value: t('design.spacing.4.value'),
				why: [
					{ idea: t('idea.lowkey'), text: t('design.spacing.4.why1') },
				],
			},
		],
	},
	{
		key: 'shape',
		label: t('design.shape.label'),
		items: [
			{
				name: t('design.shape.1.name'),
				value: t('design.shape.1.value'),
				why: [
					{ idea: t('idea.lowkey'), text: t('design.shape.1.why1') },
				],
				demo: 'radius',
			},
			{
				name: t('design.shape.2.name'),
				value: t('design.shape.2.value'),
				demo: 'borders',
				why: [
					{ idea: t('idea.readable'), text: t('design.shape.2.why1') },
				],
			},
			{
				name: t('design.shape.3.name'),
				value: t('design.shape.3.value'),
				why: [
					{ idea: t('idea.lowkey'), text: t('design.shape.3.why1') },
					{ idea: t('idea.readable'), text: t('design.shape.3.why2') },
				],
			},
			{
				name: t('design.shape.4.name'),
				value: t('design.shape.4.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.shape.4.why1') },
				],
			},
			{
				name: t('design.shape.5.name'),
				value: t('design.shape.5.value'),
				why: [
					{ idea: t('idea.restrained'), text: t('design.shape.5.why1') },
				],
			},
		],
	},
	{
		key: 'motion',
		label: t('design.motion.label'),
		items: [
			{
				name: t('design.motion.1.name'),
				value: t('design.motion.1.value'),
				demo: 'race',
				why: [
					{ idea: t('idea.restrained'), text: t('design.motion.1.why1') },
				],
			},
			{
				name: t('design.motion.2.name'),
				value: t('design.motion.2.value'),
				why: [
					{ idea: t('idea.lowkey'), text: t('design.motion.2.why1') },
				],
				demo: 'motion',
			},
			{
				name: t('design.motion.3.name'),
				value: t('design.motion.3.value'),
				why: [
					{ idea: t('idea.restrained'), text: t('design.motion.3.why1') },
				],
			},
			{
				name: t('design.motion.4.name'),
				value: t('design.motion.4.value'),
				why: [
					{ idea: t('idea.readable'), text: t('design.motion.4.why1') },
				],
			},
			{
				name: t('design.motion.5.name'),
				value: t('design.motion.5.value'),
				pending: true,
			},
		],
	},
	{
		key: 'texture',
		label: t('design.texture.label'),
		items: [
			{
				name: t('design.texture.1.name'),
				value: t('design.texture.1.value'),
				why: [
					{ idea: t('idea.personal'), text: t('design.texture.1.why1') },
				],
			},
			{
				name: t('design.texture.2.name'),
				value: t('design.texture.2.value'),
				why: [
					{ idea: t('idea.lowkey'), text: t('design.texture.2.why1') },
				],
			},
			{
				name: t('design.texture.3.name'),
				value: t('design.texture.3.value'),
				demo: 'window',
				why: [
					{ idea: t('idea.personal'), text: t('design.texture.3.why1') },
				],
				links: [{ href: '/', label: t('design.texture.3.link1') }],
			},
			{
				name: t('design.texture.4.name'),
				value: t('design.texture.4.value'),
				pending: true,
			},
		],
	},
];

export const designCount = () =>
	DESIGN_CATEGORIES.reduce((n, c) => n + c.items.filter((i) => !i.pending).length, 0);

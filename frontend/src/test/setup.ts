import "@testing-library/jest-dom/vitest";
import type { AbstractIntlMessages } from "next-intl";
import { setRuntimeLocale } from "@/i18n/runtime";
import zhMessages from "@/i18n/locales/zh/common.json";

// 组件外代码（API 客户端、AI Provider、store）靠 runtime 注册表取文案。
// 测试里统一按简体中文注册，和 src/test/intl.tsx 给组件用的语言保持一致。
setRuntimeLocale("zh", zhMessages as unknown as AbstractIntlMessages);

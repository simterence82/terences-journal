import React from "react";
import { LightingPage } from "./Lighting";

// Miscellaneous Claims is Smart Lighting's page and rules under another name,
// kept in its own collections (miscPurchases / miscFinancials).
export const MiscClaimsPage: React.FC = () => <LightingPage key="misc" scope="misc" />;

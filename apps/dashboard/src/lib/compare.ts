import { RANGE_LABEL, type RangeKey } from "./range";

export const compareLabel = (range: RangeKey) => (range === "all" ? "" : range === "24h" ? "prior 24 h" : `prior ${range.replace("d", " days")}`);

export const compareSentence = (range: RangeKey) =>
  range === "all" ? "" : range === "24h" ? ", compared with the 24 hours before" : `, compared with the ${RANGE_LABEL[range].toLowerCase()} before`;

export const rangeSentence = (range: RangeKey) => (range === "all" ? "Since 29 Sep 2026" : `Last ${RANGE_LABEL[range].toLowerCase()}`);

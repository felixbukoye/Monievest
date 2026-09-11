import { hashString, mulberry32 } from "@/lib/utils";
import type { Instrument } from "./types";

export type Sentiment = "positive" | "neutral" | "negative";

export type NewsItem = {
  id: string;
  symbol: string;
  headline: string;
  summary: string;
  source: string;
  sentiment: Sentiment;
  minutesAgo: number;
  /** Absolute timestamp, so views never need to read the clock while rendering. */
  publishedAt: number;
};

/**
 * Captured once at module load. Using it instead of `Date.now()` keeps news
 * rendering a pure function of its inputs (and keeps React Compiler happy).
 */
const NEWS_EPOCH = Date.now();

const SOURCES = [
  "Monievest Wire",
  "Market Desk",
  "The Ledger",
  "Capital Brief",
  "Trading Post",
  "Equity Watch",
];

/**
 * Headline templates. `{name}` is the company, `{sector}` its sector and
 * `{ticker}` the symbol. Selection is seeded by the ticker so a company always
 * gets the same story for a given slot — deterministic, but varied.
 */
const TEMPLATES: {
  headline: string;
  summary: string;
  sentiment: Sentiment;
}[] = [
  {
    headline: "{name} beats quarterly estimates as demand holds up",
    summary:
      "Revenue and earnings both cleared consensus, and management pointed to a stronger-than-expected order book heading into next quarter.",
    sentiment: "positive",
  },
  {
    headline: "Analysts lift price targets on {ticker} after investor day",
    summary:
      "Three desks raised targets following a presentation that leaned heavily on margin expansion and a slimmed-down cost base.",
    sentiment: "positive",
  },
  {
    headline: "{name} expands {sector} push with a new product line",
    summary:
      "The launch widens the addressable market and gives the company a foothold in an adjacent category it has been signalling for two quarters.",
    sentiment: "positive",
  },
  {
    headline: "{name} announces an expanded buyback programme",
    summary:
      "The board authorised a larger repurchase authorisation, citing strong free cash flow and a share price it considers undervalued.",
    sentiment: "positive",
  },
  {
    headline: "Supply chain pressure weighs on {name} guidance",
    summary:
      "Management trimmed its outlook, citing longer lead times and higher input costs that are unlikely to normalise before the second half.",
    sentiment: "negative",
  },
  {
    headline: "{ticker} slides as a key customer delays orders",
    summary:
      "The pull-forward pushed expected revenue into a later quarter and prompted traders to reassess near-term growth assumptions.",
    sentiment: "negative",
  },
  {
    headline: "Regulators open a review into {sector} practices",
    summary:
      "The inquiry is early-stage and no charges have been filed, but it adds a layer of uncertainty for the whole peer group.",
    sentiment: "negative",
  },
  {
    headline: "{name} holds steady ahead of its earnings print",
    summary:
      "Volumes are thin and positioning looks balanced, with options markets implying a move of roughly four percent in either direction.",
    sentiment: "neutral",
  },
  {
    headline: "Inside the {name} cost programme: what has actually changed",
    summary:
      "A close reading of the filings shows headcount reductions concentrated in middle management while engineering spend keeps rising.",
    sentiment: "neutral",
  },
  {
    headline: "{name} named to the sustainability leadership index",
    summary:
      "Inclusion is largely symbolic for near-term cash flow, but it widens the pool of mandates allowed to hold the stock.",
    sentiment: "positive",
  },
  {
    headline: "Sector rotation lifts {sector} names including {ticker}",
    summary:
      "Flows out of defensive holdings moved into the group for a third consecutive session, according to fund-tracking data.",
    sentiment: "positive",
  },
  {
    headline: "{name} faces a tighter labour market in key regions",
    summary:
      "Wage inflation at its largest facilities is running ahead of price increases, which could compress gross margin over the next two quarters.",
    sentiment: "negative",
  },
];

function fill(template: string, instrument: Instrument): string {
  return template
    .replaceAll("{name}", instrument.name.replace(/,? Inc\.?$/, "").replace(/ Corporation$/, ""))
    .replaceAll("{sector}", instrument.sector.toLowerCase())
    .replaceAll("{ticker}", instrument.symbol);
}

/** Six deterministic, plausible headlines for a given instrument. */
export function getNews(instrument: Instrument, count = 6): NewsItem[] {
  const rand = mulberry32(hashString(`${instrument.symbol}|news`));
  const picked = new Set<number>();
  const items: NewsItem[] = [];
  let minutesAgo = 12 + Math.floor(rand() * 40);

  while (items.length < count && picked.size < TEMPLATES.length) {
    const index = Math.floor(rand() * TEMPLATES.length);
    if (picked.has(index)) continue;
    picked.add(index);
    const template = TEMPLATES[index]!;
    items.push({
      id: `${instrument.symbol}-${index}`,
      symbol: instrument.symbol,
      headline: fill(template.headline, instrument),
      summary: fill(template.summary, instrument),
      source: SOURCES[Math.floor(rand() * SOURCES.length)]!,
      sentiment: template.sentiment,
      minutesAgo,
      publishedAt: NEWS_EPOCH - minutesAgo * 60_000,
    });
    minutesAgo += 45 + Math.floor(rand() * 900);
  }

  return items;
}

/** Market-wide colour for the dashboard and markets pages. */
export function getMarketHeadlines(count = 4): NewsItem[] {
  const rand = mulberry32(hashString("market|headlines"));
  const items: NewsItem[] = [];
  let minutesAgo = 4;

  const general = [
    {
      headline: "Equities hold gains as inflation data cools further",
      summary:
        "The latest print came in below consensus, reinforcing expectations that the easing cycle has further to run this year.",
      sentiment: "positive" as Sentiment,
    },
    {
      headline: "Treasury yields slip, lifting rate-sensitive sectors",
      summary:
        "Utilities, REITs and housebuilders led the advance as the ten-year benchmark drifted lower through the session.",
      sentiment: "positive" as Sentiment,
    },
    {
      headline: "AI capital expenditure keeps climbing across hyperscalers",
      summary:
        "Guidance from the largest cloud providers points to another year of double-digit growth in data-centre spend.",
      sentiment: "positive" as Sentiment,
    },
    {
      headline: "Oil retreats as supply concerns ease",
      summary:
        "Energy equities lagged the broader market after benchmark crude gave back most of the previous week's gains.",
      sentiment: "negative" as Sentiment,
    },
    {
      headline: "Breadth narrows — a handful of names are doing the work",
      summary:
        "Strategists caution that index gains remain concentrated, leaving the market vulnerable to a rotation.",
      sentiment: "neutral" as Sentiment,
    },
    {
      headline: "Retail flows turn positive for the first time in six weeks",
      summary:
        "Brokerage data shows net buying of single stocks, led by technology and financials.",
      sentiment: "positive" as Sentiment,
    },
  ];

  const used = new Set<number>();
  while (items.length < count && used.size < general.length) {
    const index = Math.floor(rand() * general.length);
    if (used.has(index)) continue;
    used.add(index);
    const item = general[index]!;
    items.push({
      id: `market-${index}`,
      symbol: "MARKET",
      headline: item.headline,
      summary: item.summary,
      source: SOURCES[Math.floor(rand() * SOURCES.length)]!,
      sentiment: item.sentiment,
      minutesAgo,
      publishedAt: NEWS_EPOCH - minutesAgo * 60_000,
    });
    minutesAgo += 30 + Math.floor(rand() * 240);
  }

  return items;
}

export function sentimentLabel(sentiment: Sentiment): string {
  return sentiment === "positive" ? "Bullish" : sentiment === "negative" ? "Bearish" : "Neutral";
}

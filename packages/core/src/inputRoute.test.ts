import assert from "node:assert/strict";
import { test } from "node:test";
import { routeInput, type InputRoute } from "./inputRoute.ts";

const cases: [string, InputRoute][] = [
  ["", "search"],
  ["github.com", "site"],
  ["https://example.com/a b", "site"],
  ["localhost:3000", "site"],
  ["youtube", "search"],
  ["weather", "search"],
  ["weather madrid", "search"],
  ["weather in madrid tomorrow", "search"],
  ["iphone 17 review", "search"],
  ["list of countries by population", "search"],
  ["help center login", "search"],
  ["resume template word", "search"],
  ["make america great again hat", "search"],
  ["how to tie a tie", "search"],
  ["cómo hacer pan", "search"],
  ["is google down", "search"],
  ["site:github.com astro browser", "search"],
  ['"exact phrase" lookup in quotes', "search"],
  ["jaguar -car speed", "search"],
  ["what is", "search"],
  ["the beatles abbey road", "search"],
  ["what is the difference between tcp and udp", "chat"],
  ["why is the sky blue", "chat"],
  ["how do I center a div in css", "chat"],
  ["how to tie a tie?", "chat"],
  ["who won?", "search"],
  ["who won the world cup in 2010?", "chat"],
  ["is it going to rain tomorrow?", "chat"],
  ["should i learn rust or go first", "chat"],
  ["explain quantum entanglement simply", "chat"],
  ["summarize this page", "chat"],
  ["write a haiku about autumn", "chat"],
  ["write me a cover letter", "chat"],
  ["translate hello world to japanese", "chat"],
  ["can you help me plan a trip to japan", "chat"],
  ["please explain recursion", "chat"],
  ["hey what's the best way to learn piano", "chat"],
  ["I need a recipe for dinner with chicken and rice", "chat"],
  ["give me 5 names for a cat", "chat"],
  ["compare react and vue for a small project", "chat"],
  ["¿por qué el cielo es azul?", "chat"],
  ["por qué el cielo es azul", "chat"],
  ["explícame la fotosíntesis", "chat"],
  ["escribe un correo para mi jefe", "chat"],
  ["dime un chiste malo", "chat"],
  ["qué tiempo hace hoy en madrid", "chat"],
  ["warum ist der himmel blau", "chat"],
  ["i was wondering what the best laptop for programming is in 2026", "chat"],
];

test("routes input to a site, a search or Chat", () => {
  for (const [input, route] of cases) assert.equal(routeInput(input), route, input);
});

test("routing a keystroke costs microseconds", () => {
  const inputs = cases.map(([input]) => input);
  for (let i = 0; i < 2000; i++) routeInput(inputs[i % inputs.length]!);
  const rounds = 50_000;
  const start = performance.now();
  for (let i = 0; i < rounds; i++) routeInput(inputs[i % inputs.length]!);
  const perCallUs = ((performance.now() - start) * 1000) / rounds;
  console.log(`routeInput: ${perCallUs.toFixed(2)} µs per call`);
  assert.ok(perCallUs < 100, `${perCallUs} µs`);
});

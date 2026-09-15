/**
 * Deterministic make/model -> SD body class seed (Phase 1 resolver data).
 *
 * WHY THIS EXISTS: PR1's `assessShipment` resolves vehicle class from a structured
 * category first and a ~30-model seed second; anything else is `needs_input`
 * ("vehicle"). That is the right fail-closed rule for the website form, where a
 * category dropdown exists. ProABD records carry NO category, only free-text
 * make/model, so almost every CRM lead would fall through to needs_input and the
 * agent card would show nothing. This seed closes that gap deterministically:
 * a model either maps to sedan/suv/pickup here, or it stays unresolved and the
 * agent is asked. Nothing is guessed. (Phase 2 = NHTSA vPIC by VIN.)
 *
 * SD prices three body classes only. Mapping rules:
 *   sedan  : cars, coupes, hatchbacks, wagons, convertibles, sports and exotic cars,
 *            classics (a 1967 Mustang is a "sedan" to SD's pricing model)
 *   suv    : SUVs, crossovers, vans, minivans, Jeeps, Broncos, Land Rovers
 *   pickup : half-ton, 3/4-ton and midsize pickups. Heavy trucks (F-250+, 2500/3500,
 *            dually, box truck) are DENIED upstream by assessment.ts and never reach
 *            this seed as a class.
 *
 * Callers pass the result into RawShipmentInput.category so assessment.ts keeps
 * its deny-lists (RV, heavy truck, boat, modified) ahead of the class. Pure; no I/O.
 * Order of evaluation: pickup rules, then SUV rules, then sedan rules, then
 * single-class makes. Mixed makes (Ford, Chevrolet, Toyota...) with an unknown
 * model stay unresolved on purpose.
 */

export type SeedClass = "sedan" | "suv" | "pickup";

export interface SeedResolution {
  cls: SeedClass | null;
  /** How the class was decided; "unresolved" means ask the agent. */
  by: "model" | "make" | "unresolved";
}

type Rule = [RegExp, SeedClass];

const PICKUP_RULES: Rule[] = [
  [/\bf-?150\b|\bf150\b|\bf-?100\b|\bf100\b|\bf-?1\b|\blightning\b|\branger\b/i, "pickup"],
  [/\bsilverado\b(?!.*(2500|3500))|\bsierra\b(?!.*(2500|3500))|\bcolorado\b|\bcanyon\b|\bavalanche\b|\bcheyenne\b|\bel camino\b|\bs-?10\b|\bsonoma\b|\bsyclone\b/i, "pickup"],
  [/\b(c|k)-?(10|15|20|1500)\b(?!.*(suburban|blazer|jimmy))|\bc\/k\b|\bc10\/k10\b|\bc20\/k20\b|\bk25\b|\bk2500\b|\b3100\b|\bh3100\b|\b3600\b|\b3800\b(?!.*buick)|\bapache\b|\bstepside\b|\bfleetside\b/i, "pickup"],
  [/(?<!sprinter\s)(?<!promaster\s)\bram\s*1500\b|\b1500\s*classic\b|\bdakota\b|\bd-?100\b|\bd-?150\b|\bdodge\s+ram\b(?!.*(2500|3500|promaster|van))|\bram\s+(pickup|truck)\b/i, "pickup"],
  [/\btacoma\b|\btundra\b|\bt-?100\b|\bhilux\b|\bfrontier\b|\btitan\b(?!.*xd)|\bridgeline\b|\bgladiator\b|\bsanta cruz\b|\bcybertruck\b|\br1t\b|\bhummer ev\b(?!.*suv)/i, "pickup"],
  [/\bcomanche\b|\brampage\b|\bb-?(series|2000|2200|2300|2500|3000|4000)\b|\bd21\b|\bhardbody\b|\bmighty max\b|\bscottsdale\b|\bcourier\b|\bluv\b|\bp'?up\b/i, "pickup"],
  [/(?<!sprinter\s)(?<!promaster\s)(?<!metris\s)\bgmc\s+1500\b|\bchevrolet\s+1500\b|\bchevy\s+1500\b|\bpickup\b|\btruck\b(?!.*(box|flatbed|dump|tow))/i, "pickup"],
];

const SUV_RULES: Rule[] = [
  [/\bmodel\s*[xy]\b/i, "suv"],
  [/\bcayenne\b|\bmacan\b|\burus\b|\bpurosangue\b|\bbentayga\b|\bcullinan\b|\bdbx\b|\blevante\b|\bgrecale\b|\bstelvio\b|\beletre\b|\btonale\b/i, "suv"],
  [/\bwrangler\b|\bgrand cherokee\b|\bcherokee\b|\bcompass\b|\brenegade\b|\bpatriot\b|\bliberty\b|\bcommander\b|\bwagoneer\b|\bcj-?\d\b|\bcj\b|\bjeep\s+willys\b|\bscrambler\b|\bjeepster\b/i, "suv"],
  [/\bbronco\b|\bexplorer\b|\bexpedition\b|\bescape\b|\bedge\b|\bflex\b|\bexcursion\b|\becosport\b|\bmach-?e\b|\btransit\b|\be-?series\b|\becono ?line\b|^ford\s+e-?\d{3}\b|\bwindstar\b|\baerostar\b|\bfreestyle\b|\btaurus x\b|\bclub wagon\b/i, "suv"],
  [/\btahoe\b|\bsuburban\b|\bequinox\b|\btraverse\b|\btrailblazer\b|\bblazer\b|\btrax\b|\bhhr\b|\bastro\b|\bexpress\b|\bcaptiva\b|\buplander\b|\bventure\b|\byukon\b|\bacadia\b|\bterrain\b|\benvoy\b|\bjimmy\b|\bsavana\b|\bsafari\b|\bhummer\b|\bh[123]t?\b|\bcarryall\b/i, "suv"],
  [/\bescalade\b|\bxt[456]\b|\bsrx\b|\blyriq\b|\bencore\b|\benclave\b|\benvision\b|\benvista\b|\brendezvous\b|\brainier\b|\bmountaineer\b|\baviator\b|\bnavigator\b|\bcorsair\b|\bnautilus\b|\bmk[xct]\b/i, "suv"],
  [/\bdurango\b|\bjourney\b|\bnitro\b|\bcaravan\b|\bvoyager\b|\bpacifica\b|\btown\s*(&|and)\s*country\b|\baspen\b|\bdodge\s+hornet\b|\bramcharger\b|\bpromaster\b|\btrailduster\b|\bb-?(150|250|350)\s*van\b/i, "suv"],
  [/\brav-?4\b|\bhighlander\b|\b4-?runner\b|\bsequoia\b|\bland cruiser\b|\bfj cruiser\b|\bfj-?40\b|\bvenza\b|\bsienna\b|\bc-?hr\b|\bcorolla cross\b|\bbz4x\b|\bprevia\b/i, "suv"],
  [/\bcr-?v\b|\bhr-?v\b|\bpilot\b|\bpassport\b|\bodyssey\b|\belement\b|\bprologue\b|\bmdx\b|\brdx\b|\bzdx\b|\badx\b/i, "suv"],
  [/\brogue\b|\bmurano\b|\bpathfinder\b|\barmada\b|\bkicks\b|\bjuke\b|\bxterra\b|\bquest\b|\bariya\b|\bnv\s?\d{3,4}\b|\bqx\d{2}\b|\bfx\d{2}\b|\bjx35\b/i, "suv"],
  [/\btucson\b|\bsanta fe\b|\bpalisade\b|\bkona\b|\bvenue\b|\bioniq [57]\b|\bnexo\b|\bsportage\b|\bsorento\b|\btelluride\b|\bseltos\b|\bsoul\b|\bniro\b|\bcarnival\b|\bsedona\b|\bev9\b|\bgv\d{2}\b/i, "suv"],
  [/\boutback\b|\bforester\b|\bcrosstrek\b|\bascent\b|\btribeca\b|\bsolterra\b|\bcx-?[3579]0?\b|\bmpv\b|\btribute\b|\bnavajo\b/i, "suv"],
  [/\bx[1-7]m?\b|\bix[13]?\b|\bxm\b|\bgl[abcekls]\b|\bg-?class\b|\bg ?wagon\b|^mercedes[- ]?(benz)?\s+g\s?\d{2,3}\b|\bml\s?\d{3}\b|\bgl\s?\d{3}\b|\bgls\s?\d{3}\b|\bgle\s?\d{3}\b|\bglc\s?\d{3}\b|\beq[bes] suv\b|\beqb\b|\bsprinter\b|\bmetris\b|\br-?class\b/i, "suv"],
  [/\bq[3578]\b|\bq4\b|\be-?tron\b(?!\s*gt)|\bsq[578]\b|\btiguan\b|\batlas\b|\btouareg\b|\btaos\b|\bid\.?4\b|\bid\.? ?buzz\b|\beurovan\b|\bvanagon\b|\bmicrobus\b|\bbus\b|\bcampmobile\b|\bwestfalia\b|\btransporter\b|\bkombi\b|\bsamba\b/i, "suv"],
  [/\bxc\d{2}\b|\bex[39]0\b|\brange rover\b|\bdiscovery\b|\bdefender\b|\blr[234]\b|\bfreelander\b|\bevoque\b|\bvelar\b|\bland ?rover\b|\bf-?pace\b|\be-?pace\b|\bi-?pace\b/i, "suv"],
  [/\b(rx|nx|gx|lx|ux|tx|rz)\s?\d{3}[hl]?\b|\b(rx|nx|gx|lx|ux|tx|rz)\b/i, "suv"],
  [/\bsaturn vue\b|\bvue\b|\boutlook\b|\brelay\b|\bbravada\b|\bsilhouette\b|\btrooper\b|\brodeo\b|\bamigo\b|\bmontero\b|\boutlander\b|\beclipse cross\b|\bendeavor\b|\bpajero\b|\bscout\b|\btravelall\b|\bsamurai\b|\bsidekick\b|\bvitara\b|\bxl-?7\b|\bland cruiser\b/i, "suv"],
  [/\br1s\b|\bgravity\b|\bfisker ocean\b|\bocean\b|\bvinfast\b|\bpolestar [34]\b|\bblazer ev\b|\bequinox ev\b|\bbolt euv\b/i, "suv"],
  [/\bminivan\b|\bconversion van\b|\bcargo van\b|\bpassenger van\b|\bvan\b|\bsuv\b|\bcrossover\b/i, "suv"],
];

const SEDAN_RULES: Rule[] = [
  [/\bmodel\s*[3s]\b/i, "sedan"],
  [/\b911\b|\bboxster\b|\bcayman\b|\bpanamera\b|\btaycan\b|\b356[abc]?\b|\b912\b|\b914\b|\b924\b|\b928\b|\b944\b|\b968\b|\b718\b|\bcarrera\b/i, "sedan"],
  [/\bcorvette\b|\bcamaro\b|\bmustang\b(?!.*mach-?e)|\bchallenger\b|\bcharger\b|\bimpala\b|\bmalibu\b|\bcruze\b|\bcobalt\b|\bcavalier\b|\bmonte carlo\b|\bchevelle\b|\bnova\b|\bbel ?air\b|\b210\b|\b150\b|\bcorvair\b|\bchevy ii\b|\bcaprice\b|\bbiscayne\b|\bfleetline\b|\bmaster\b|\bsonic\b|\bspark\b|\baveo\b|\bbolt\b(?!.*euv)|\bvolt\b|\blumina\b|\bcelebrity\b|\bcitation\b|\bvega\b|\bchevette\b|\bberetta\b|\bcorsica\b|\bstyleline\b|\bsedan delivery\b|\bdelray\b|\bkingswood\b|\bnomad\b/i, "sedan"],
  [/\bcorolla\b|\bcamry\b|\bavalon\b|\bprius\b|\byaris\b|\bcelica\b|\bsupra\b|\bmr-?2\b|\bgr86\b|\b86\b|\bcressida\b|\btercel\b|\becho\b|\bmatrix\b|\bsolara\b|\bcrown\b|\bmirai\b|\bpaseo\b|\bcorona\b|\bgr corolla\b/i, "sedan"],
  [/\bcivic\b|\baccord\b|\bfit\b|\binsight\b|\bclarity\b|\bprelude\b|\bs2000\b|\bcrx\b|\bcr-?z\b|\bdel sol\b|\bintegra\b|\btlx\b|\bilx\b|\brlx\b|\btsx\b|\btl\b|\brl\b|\bnsx\b|\brsx\b|\blegend\b|\bcl\b/i, "sedan"],
  [/\baltima\b|\bsentra\b|\bmaxima\b|\bversa\b|\bleaf\b|\b370z\b|\b350z\b|\b300zx\b|\b240z\b|\b280z\b|\b260z\b|\b240sx\b|\bz\b|\bgt-?r\b|\bskyline\b|\b1200\b|\b510\b|\bb210\b|\b(q|g|m|i|j)\d{2}[xht]?\b/i, "sedan"],
  [/\belantra\b|\bsonata\b|\baccent\b|\bveloster\b|\bgenesis coupe\b|\bioniq 6\b|\bioniq\b(?!\s*[57])|\bazera\b|\bequus\b|\bg[789]0\b|\bforte\b|\boptima\b|\bk[45]\b|\brio\b|\bstinger\b|\bcadenza\b|\bspectra\b|\bamanti\b|\bev6\b/i, "sedan"],
  [/\bmazda\s*-?\s*[236]\b|\bmazda[236]\b|\bmx-?[356]\b|\bmiata\b|\brx-?[78]\b|\bprotege\b|\bmillenia\b|\b626\b|\b323\b|\bimpreza\b|\bwrx\b|\bsti\b|\blegacy\b|\bbrz\b|\bsvx\b|\bfr-?s\b|\btc\b|\bxb\b|\bxd\b|\biq\b/i, "sedan"],
  [/\b[1-8] ?series\b|^bmw\s+[1-8]\d{2}[ie]?\w*\b|\bm[2-8]\b|\bz[348]\b|\bi[3-8]\b|\b2002\b|\bisetta\b/i, "sedan"],
  [/\b[cesab]-?class\b|^mercedes[- ]?(benz)?\s+(amg\s+)?[cesab]\d{2,3}\b|\bcl[aks]\b|\bcls\b|\bcla\b|\bsl\b|\bslk\b|\bslc\b|\bslr\b|\bsls\b|\bamg gt\b|\beq[es]\b(?!\s*suv)|\bmaybach\b|\b190[e]?\b|\b230\b|\b250c?\b|\b280\b|\b300[dsecl]?\b|\b380\b|\b450\b|\b500\b(?!x)|\b560\b|\b600\b/i, "sedan"],
  [/\ba[3-8]\b|\bs[3-8]\b|\brs\s?[3-7]\b|\btt\b|\br8\b|\be-?tron gt\b|\bjetta\b|\bpassat\b|\bgolf\b|\bgti\b|\bbeetle\b|\bbug\b|\bkarmann\b|\bghia\b|\bcc\b|\barteon\b|\brabbit\b|\bcabrio\b|\bthing\b|\bscirocco\b|\bcorrado\b|\bsquareback\b|\bfastback\b|\bnotchback\b|\bid\.?7\b|\bphaeton\b/i, "sedan"],
  [/\bs[469]0\b|\bv[4679]0\b|\bc[37]0\b|\b[12]40\b|\b[78]50\b|\b960\b|\bp1800\b|\b122\b|\bamazon\b|\bxf\b|\bxj\b|\bxe\b|\bxk[er]?\b|\bx-?type\b|\bs-?type\b|\bf-?type\b|\bmark\s?(ii|2|x|1|i|vii|viii|lt)\b|\be-?type\b|\b2\.4\b|\b3\.4\b|\b3\.8\b|\b4\.2\b/i, "sedan"],
  [/\bcontinental\b|\bflying spur\b|\bmulsanne\b|\barnage\b|\bazure\b|\bphantom\b|\bghost\b|\bwraith\b|\bdawn\b|\bspectre\b|\bsilver\s?(spur|spirit|shadow|cloud|seraph|wraith)\b|\bcorniche\b|\bvantage\b|\bdb\d{1,2}\b|\bvanquish\b|\brapide\b|\bdbs\b|\bvalkyrie\b/i, "sedan"],
  [/^(ferrari|lamborghini|mclaren|bugatti|pagani|koenigsegg)\b|\bhuracan\b|\bgallardo\b|\baventador\b|\bmurcielago\b|\brevuelto\b|\bdiablo\b|\bcountach\b|\bghibli\b|\bquattroporte\b|\bgranturismo\b|\bgran ?cabrio\b|\bmc20\b|\broma\b|\bportofino\b|\bcalifornia\b|\b488\b|\b458\b|\b360\b|\bf8\b|\bsf90\b|\b296\b|\b812\b|\bgiulia\b|\b4c\b|\bspider\b/i, "sedan"],
  [/\bfusion\b|\bfocus\b|\bfiesta\b|\btaurus\b|\bcrown vic\w*\b|\bthunderbird\b|\bt-?bird\b|\bgalaxie\b|\bfalcon\b|\bfairlane\b|\btorino\b|\branchero\b|\bltd\b|\bmodel [at]\b|\bcoupe\b|\broadster\b|\bcustom\w*\b|\bdeluxe\b|\bcustomline\b|\bcrestline\b|\banglia\b|\bcortina\b|\bcapri\b|\bpinto\b|\bescort\b|\btempo\b|\bcontour\b|\bprobe\b|\bgt40\b|\bford gt\b|\bcougar\b|\bmarauder\b|\bgrand marquis\b|\bsable\b|\bmilan\b|\bmontego\b|\bcomet\b|\bcyclone\b|\bmonarch\b|\bzephyr\b|\bmk[zs]\b|\btown car\b|\bfairmont\b|\bgranada\b|\bmaverick\b|\bstarliner\b|\bsunliner\b|\bskyliner\b|\bvictoria\b|\btudor\b|\bfordor\b/i, "sedan"],
  [/\bdart\b|\bneon\b|\bstratus\b|\bintrepid\b|\bavenger\b|\bmagnum\b|\bviper\b|\bcoronet\b|\bpolara\b|\bmonaco\b|\bsuper bee\b|\bdemon\b|\bdiplomat\b|\bomni\b|\bshadow\b|\bspirit\b|\bdynasty\b|\bdaytona\b|\blancer\b|\b330\b|\b440\b|\b880\b|\bmeadowbrook\b|\bwayfarer\b|\bcoronado\b/i, "sedan"],
  [/\bduster\b|\bbarracuda\b|\bcuda\b|\broad ?runner\b|\bsatellite\b|\bgtx\b|\bvaliant\b|\bfury\b|\bbelvedere\b|\bsavoy\b|\bscamp\b|\bvolare\b|\b300[cm]?\b|\bsebring\b|\bcirrus\b|\bconcorde\b|\blhs\b|\bcrossfire\b|\bpt cruiser\b|\bnew yorker\b|\bimperial\b|\blebaron\b|\bcordoba\b|\bnewport\b|\bwindsor\b|\bfifth avenue\b|\bfiredome\b|\bfireflite\b|\bairflow\b|\bsaratoga\b/i, "sedan"],
  [/\bgto\b|\bfirebird\b|\btrans ?am\b|\bgrand prix\b|\bgrand am\b|\blemans\b|\ble mans\b|\bbonneville\b|\bcatalina\b|\btempest\b|\bstar chief\b|\bstreamliner\b|\bchieftain\b|\bfiero\b|\bsolstice\b|\bg[68]\b|\bsunfire\b|\bvibe\b|\bventura\b|\bsafari wagon\b/i, "sedan"],
  [/\b442\b|\bcutlass\b|\btoronado\b|\b88\b|\b98\b|\bsuper 88\b|\bdelta 88\b|\bninety-?eight\b|\balero\b|\bintrigue\b|\baurora\b|\bachieva\b|\bcalais\b|\bstarfire\b|\bjetstar\b|\bregal\b|\bskylark\b|\briviera\b|\blesabre\b|\bwildcat\b|\belectra\b|\bcentury\b|\bgrand national\b|\bgs\b|\bgnx\b|\bpark avenue\b|\blucerne\b|\blacrosse\b|\bverano\b|\broadmaster\b|\bspecial\b|\bsuper\b|\binvicta\b|\breatta\b|\bcascada\b|\bapollo\b|\bskyhawk\b/i, "sedan"],
  [/\bdeville\b|\bde ville\b|\beldorado\b|\bseville\b|\bfleetwood\b|\bcts\b|\bats\b|\bxts\b|\bct[456]\b|\bsts\b|\bdts\b|\bxlr\b|\ballante\b|\bcatera\b|\bcimarron\b|\bseries 6\d\b|\bbrougham\b|\bcelestiq\b|\bcoupe de ville\b|\bcalais\b/i, "sedan"],
  [/\b(is|es|gs|ls|rc|lc|sc)\s?\d{3}[hf]?\b|\bct\s?200h\b|\b(is|es|gs|ls|rc|lc|sc)\b/i, "sedan"],
  [/\bcorsa\b|\bcooper\b(?!.*countryman)|\bclubman\b|\b500\b(?!x)|\b124\b|\b850\b|\bx1\/9\b|\bfortwo\b|\b9-?[35]\b|\b900\b|\b99\b|\bsonett\b|\bds ?21\b|\b2cv\b|\bmga\b|\bmgb\b|\bmg ?td\b|\bmg ?tf\b|\bmidget\b|\bspitfire\b|\btr[3-8]\b|\bstag\b|\bhealey\b|\b3000\b|\bsprite\b|\btiger\b|\balpine\b|\bmanta\b|\bkadett\b|\bdmc-?12\b|\bavanti\b|\bmetropolitan\b|\bcoach\b|\bamx\b|\bjavelin\b|\bgremlin\b|\bpacer\b|\bambassador\b|\brambler\b|\bmatador\b|\bhornet\b|\bwillys\s+(aero|americar)\b|\bkarmann\b/i, "sedan"],
  [/\bsedan\b|\bhatchback\b|\bwagon\b|\bconvertible\b|\bcabriolet\b|\bspyder\b|\bhardtop\b|\b2-?door\b|\b4-?door\b|\bcoupe\b|\bsports? ?car\b/i, "sedan"],
  [/\blucid air\b|\bair\b|\bpolestar [12]\b|\bpolestar\b/i, "sedan"],
];

/* Make-level fallback ONLY for makes whose entire lineup is one SD class. */
const MAKE_RULES: Rule[] = [
  [/^(ferrari|lamborghini|mclaren|bugatti|pagani|koenigsegg|lotus|alfa ?romeo|alfa|maserati|aston ?martin|aston|bentley|rolls ?royce|rolls|de ?lorean|mini|smart|fiat|saab|triumph|mg|austin ?healey|austin|morgan|sunbeam|studebaker|packard|hudson|nash|edsel|plymouth|desoto|pontiac|oldsmobile|buick|mercury|lincoln|acura|infiniti|genesis|lexus|jaguar|volvo|polestar|lucid|scion|datsun|amc|american motors|opel|peugeot|renault|citroen|crosley|kaiser|terraplane|tucker|cord|auburn|duesenberg)$/i, "sedan"],
  [/^(jeep|land ?rover|range ?rover|hummer|rivian|international|willys|isuzu)$/i, "suv"],
];

const norm = (v: unknown) => (v == null ? "" : String(v)).trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Resolve make + model (+ year for era-ambiguous names) to an SD class, or unresolved.
 * Pure. Never throws.
 */
export function resolveVehicleClassSeed(make: unknown, model: unknown, year?: unknown): SeedResolution {
  const mk = norm(make), md = norm(model);
  const mm = (mk + " " + md).trim();
  if (!mm) return { cls: null, by: "unresolved" };
  const y = Number(String(year ?? "").trim());

  // Era-ambiguous names: same badge, different body.
  if (/\bmaverick\b/.test(mm)) return { cls: Number.isFinite(y) && y >= 2021 ? "pickup" : "sedan", by: "model" };
  if (/\bel camino\b|\branchero\b|\bcaballero\b/.test(mm)) return { cls: "pickup", by: "model" };

  for (const [re, cls] of PICKUP_RULES) if (re.test(mm)) return { cls, by: "model" };
  for (const [re, cls] of SUV_RULES) if (re.test(mm)) return { cls, by: "model" };
  for (const [re, cls] of SEDAN_RULES) if (re.test(mm)) return { cls, by: "model" };
  for (const [re, cls] of MAKE_RULES) if (re.test(mk)) return { cls, by: "make" };
  return { cls: null, by: "unresolved" };
}

/* Vehicles for which the trailer default "open" is least trustworthy (field-defaults
 * findings 2026-09-09: only 20 of 316 classic/exotic-shaped shipments carried the
 * enclosed flag while 19 of 87 open ones were priced as if enclosed). Used to raise
 * CONFIRM_TRANSPORT on the card. */
export const CLASSIC_YEAR_MAX = 1975;
export const EXOTIC_MAKE_RE = /ferrari|lamborghini|maserati|bentley|rolls|aston|mclaren|bugatti|lotus|maybach|porsche|tesla/i;

export function isPremiumShaped(year: unknown, make: unknown): boolean {
  const y = Number(String(year ?? "").trim());
  const classic = Number.isFinite(y) && y > 1900 && y <= CLASSIC_YEAR_MAX;
  return classic || EXOTIC_MAKE_RE.test(norm(make));
}

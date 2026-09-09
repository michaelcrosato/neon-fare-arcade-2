import type { Job } from "./model";

export type PassengerStars = 1 | 2 | 3 | 4 | 5;

/** Regional trips need a full route allowance, not the arcade clock's cap. */
export function passengerRatingParSeconds(routeDistance: number) {
  return Math.max(11, routeDistance / 17 + 6);
}

/** Time dominates; even one recorded impact costs a star. */
export function passengerRating(seconds: number, parSeconds: number, hadCollision: boolean): PassengerStars {
  const ratio = Math.max(0, seconds) / Math.max(1, parSeconds);
  const speedStars = ratio <= 1 ? 5 : ratio <= 1.35 ? 4 : ratio <= 1.8 ? 3 : ratio <= 2.4 ? 2 : 1;
  return Math.max(1, speedStars - (hadCollision ? 1 : 0)) as PassengerStars;
}

export function passengerTip(baseFare: number, stars: PassengerStars) {
  return stars === 5 ? Math.round(baseFare * 0.25) : stars === 4 ? Math.round(baseFare * 0.1) : 0;
}

// Each portrait has its own reason for travelling. The five reactions keep
// that character's voice while responding to the actual trip result.
const RIDER_PLANS = [
  "my salsa set", "my rooftop telescope", "my championship rematch", "my midnight premiere",
  "my beehive inspection", "my vinyl digging", "my surf lesson", "my runway debut",
  "my mural unveiling", "my arcade record", "my greenhouse seedlings", "my family barbecue",
  "my poetry reading", "my espresso tasting", "my moonlight shoot", "my garage band",
  "my chess final", "my robotics demo", "my fishing charter", "my kite festival",
  "my peace rally", "my roller derby", "my book launch", "my pottery class",
  "my guitar solo", "my ballet rehearsal", "my pasta workshop", "my crossword club",
  "my bowling league", "my dance audition", "my comic signing", "my jewelry show",
  "my bonsai pruning", "my film screening", "my street portraits", "my sunrise yoga",
  "my vintage boutique", "my flight connection", "my sculpture opening", "my dog agility trial",
  "my tea ceremony", "my lantern parade", "my astronomy lecture", "my birdwatching walk",
  "my improv night", "my treasure hunt", "my flower stall", "my bread starter",
  "my garden fence", "my orchard harvest", "my quilting circle", "my school recital",
  "my town council speech", "my apple pie contest", "my library shift", "my creek cleanup",
  "my model railway", "my nursery delivery", "my community choir", "my porch concert",
  "my antique clock", "my farmers market", "my woodworking bench", "my neighborhood picnic",
  "my flower arranging", "my pottery kiln", "my walking group", "my seed exchange",
  "my bicycle repair", "my allotment plot", "my bake sale", "my homecoming dinner",
  "my summit photograph", "my ski patrol", "my climbing partner", "my lodge check-in",
  "my trail survey", "my snowboard heat", "my winter supplies", "my mountain rescue drill",
  "my alpine sketchbook", "my chairlift shift", "my snowshoe group", "my eagle lookout",
  "my cabin fireplace", "my downhill training", "my gemstone collection", "my ridge hike",
  "my stargazing camp", "my cloud timelapse", "my trail bike", "my hot cocoa stand",
  "my avalanche workshop", "my wilderness course", "my ice sculpture", "my peak picnic",
  "my desert dance", "my canyon tour", "my observatory shift", "my mineral exhibit",
  "my roadside tamales", "my engine rebuild", "my weaving loom", "my radio broadcast",
  "my cactus nursery", "my sunset serenade", "my adobe restoration", "my desert fossils",
  "my dove sanctuary", "my rally checkpoint", "my meteor shower", "my silver workshop",
  "my painted ceramics", "my dune buggy", "my oasis survey", "my rodeo practice",
  "my canyon watercolors", "my freight pickup", "my geology class", "my prospecting crew",
  "my bayou sketch walk", "my wetland ballet", "my marsh star chart", "my riverside supper",
  "my ferry shift", "my pier jam session", "my mangrove seedlings", "my boat restoration",
  "my fishing nets", "my kayak rental", "my heron count", "my tide gauge",
  "my oyster stall", "my boardwalk exhibit", "my riverboat rehearsal", "my coastal survey",
  "my reed weaving", "my harbor radio", "my causeway patrol", "my saltwater aquarium",
  "my lagoon picnic", "my lighthouse visit", "my crab traps", "my seagrass project",
  "my beach volleyball", "my board shaping", "my ocean swim", "my seaside wedding",
  "my sandcastle entry", "my beach cleanup", "my coastal concert", "my sailboat launch",
  "my coral research", "my pier photography", "my beachside tacos", "my sunset cruise",
  "my paddleboard race", "my shell collection", "my sea glass mosaic", "my harbor brunch",
  "my lifeguard training", "my marine rescue", "my boardwalk busking", "my coastal cycling",
  "my saltwater taffy", "my tidepool tour", "my beachfront cinema", "my oceanfront dinner",
] as const;

export function passengerComment(job: Pick<Job, "passengerArtCell">, stars: PassengerStars) {
  const plan = RIDER_PLANS[job.passengerArtCell] ?? "my next adventure";
  switch (stars) {
    case 5: return `Early for ${plan}! You're a legend. Keep the tip!`;
    case 4: return `Made it for ${plan}. Thanks — a little extra for you.`;
    case 3: return `There goes my spare time before ${plan}. An okay ride.`;
    case 2: return `I'm late for ${plan}. That ride needed work.`;
    case 1: return `I missed ${plan}. Next time, I'm walking.`;
  }
}

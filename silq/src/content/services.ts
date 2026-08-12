import type { ImageSlot } from "./images";

export type ServiceSection = {
  heading: string;
  paragraphs: string[];
};

export type ServiceFaq = {
  question: string;
  answer: string;
};

export type Service = {
  /** URL segment under /services — written long-form because that is how this market is searched. */
  slug: string;
  /** Display name in the showcase and nav. */
  name: string;
  /** Short label for chips, breadcrumbs and pre-filled WhatsApp messages. */
  shortName: string;
  /** One line. Read as a promise, not a feature list. */
  promise: string;
  /** Two to three sentences for the showcase block. */
  description: string;
  /** Human-readable range, e.g. "2 – 4 hrs". */
  duration: string;
  /** Starting price in AED. Displayed as "from AED X". */
  priceFrom: number;
  /** Image slot key from the manifest. */
  image: ImageSlot;
  /** Long-form content for the SEO sub-page. */
  page: {
    title: string;
    description: string;
    h1: string;
    lede: string;
    sections: ServiceSection[];
    faqs: ServiceFaq[];
  };
};

export const SERVICES: Service[] = [
  {
    slug: "haircut-at-home-dubai",
    name: "Hair Cutting",
    shortName: "a haircut",
    promise: "A cut built around how your hair actually falls.",
    description:
      "Dry-cut assessment first, then a precision cut finished to the shape you will style yourself. We work with your growth pattern and density rather than against them. Includes a wash and blow-dry at your basin or ours.",
    duration: "1 – 1.5 hrs",
    priceFrom: 250,
    image: "svc-cutting",
    page: {
      title: "Haircut at Home in Dubai | Senior Stylists | SILQ",
      description:
        "A senior stylist cuts your hair at home anywhere in Dubai. Precision cutting, wash and blow-dry, full setup brought to you. From AED 250.",
      h1: "Haircut at home in Dubai",
      lede: "A proper cut, in your own bathroom light, without the drive to Jumeirah and back.",
      sections: [
        {
          heading: "How we cut",
          paragraphs: [
            "Most disappointing haircuts are decided before the scissors come out. We start dry, with your hair the way you normally wear it, and look at how it actually behaves — where it splits, where it kicks, where the weight sits. That takes ten minutes and it is the part that determines whether the cut still works three weeks later.",
            "From there we wash, section and cut wet, then dry and refine. The refinement pass matters: hair moves when it dries, and a shape that looked balanced under tension often is not. We check the outline dry, in your light, standing the way you stand.",
            "You get a cut you can reproduce. If a shape only holds when a stylist blows it out with two brushes and a diffuser, it is the wrong shape for someone who has eight minutes in the morning. We will tell you that rather than sell you the blow-dry.",
          ],
        },
        {
          heading: "What we bring",
          paragraphs: [
            "A portable basin attachment that works with a standard bathroom or kitchen tap, a professional chair cover, a rolling trolley, salon-grade shears, clippers where relevant, and a professional dryer. Floors are covered before we start and the cut hair is collected and taken away.",
            "You need a chair, a plug socket and a tap. That is the entire requirement. There is no setup fee and nothing to buy in advance.",
          ],
        },
        {
          heading: "Cuts we take on",
          paragraphs: [
            "Long layers, blunt bobs, French bobs, curtain bangs, curly cutting done dry and in its natural pattern, fringe reshaping, and maintenance trims on colour-treated hair where length retention matters. We also cut children's hair — see the pricing section for the kids' rate.",
            "If you are growing something out, say so at the consultation. Growing out a fringe or a short layer is a plan across three or four appointments, not a single visit, and the cut should be shaped to make that easier rather than reset it each time.",
          ],
        },
      ],
      faqs: [
        {
          question: "Do I need to wash my hair before you arrive?",
          answer:
            "No. We prefer to see it as you normally wear it — second-day hair is genuinely more useful for reading your growth pattern. We wash it as part of the appointment.",
        },
        {
          question: "How much space do you need?",
          answer:
            "A chair with clear space around it and access to a tap. A kitchen or a bathroom both work. We cover the floor and clean up before we leave.",
        },
        {
          question: "Can you cut curly hair dry?",
          answer:
            "Yes. Curly hair is cut dry, curl by curl, in its natural pattern. Tell us when you book so we allow the extra time.",
        },
      ],
    },
  },
  {
    slug: "hair-colouring-at-home-dubai",
    name: "Hair Colouring",
    shortName: "hair colouring",
    promise: "Colour formulated for your hair, not for a swatch book.",
    description:
      "Root touch-ups, full colour, grey coverage and colour correction, mixed on site after we have seen your hair in daylight. We patch test, we tell you what is achievable in one visit, and we never promise a five-level lift over lunch.",
    duration: "2 – 4 hrs",
    priceFrom: 450,
    image: "svc-colouring",
    page: {
      title: "Hair Colouring at Home in Dubai | Colour Specialists | SILQ",
      description:
        "Professional hair colour at home across Dubai. Root touch-ups, full colour, grey coverage and correction by senior colourists. From AED 450.",
      h1: "Hair colouring at home in Dubai",
      lede: "A colourist, a trolley of professional product, and your own bathroom mirror to check it in.",
      sections: [
        {
          heading: "Formulated on site",
          paragraphs: [
            "Colour is mixed at your home after we have looked at your hair in natural light — not decided over WhatsApp from a photo taken under a warm bulb. Two people asking for the same shade almost never need the same formula, because what is already on the hair changes everything.",
            "We read four things before mixing: your natural base, the depth and tone of any existing colour, the porosity along the mid-lengths, and how much grey there is and where it sits. Grey at the hairline behaves differently from grey scattered through the crown, and it needs a different coverage approach.",
            "If what you want is not achievable safely in one visit, we say so at the consultation rather than halfway through. Lifting darkened, previously coloured hair to a clean blonde is a staged process across two or three appointments. Compressing it into one afternoon is how hair breaks.",
          ],
        },
        {
          heading: "Grey coverage that does not go flat",
          paragraphs: [
            "Full opaque coverage on resistant grey tends to read as solid and slightly matte, which is why grown-out box colour looks heavier than salon colour. We build coverage with a base plus a reflective tone so the result keeps some movement through it, and we adjust the ratio as the percentage of grey changes over the years.",
            "Root touch-ups run every four to six weeks depending on how fast you grow and how strong the contrast is. We keep your formula on file so the next visit matches, and adjust it seasonally — hair lightens in a Dubai summer whether or not you intended it to.",
          ],
        },
        {
          heading: "Colour correction",
          paragraphs: [
            "Banding, hot roots, brassy mid-lengths, a home kit that went green, or a salon result that came out three tones off — correction is its own service and it is quoted after we see the hair, not before. Send a photo in daylight when you enquire and we will give you an honest range and a realistic number of sessions.",
            "Correction sometimes means going darker first, or accepting a warmer result this visit and cooling it at the next. We would rather set that expectation on the phone than surprise you with it.",
          ],
        },
      ],
      faqs: [
        {
          question: "Do you supply the colour or do I buy it?",
          answer:
            "We supply everything. Professional colour, developer, bond protector, toner and aftercare are all included in the price. You never need to buy product in advance.",
        },
        {
          question: "Do you patch test?",
          answer:
            "Yes, and it matters. For a first colour appointment we arrange a patch test at least 48 hours in advance. Message us before you book the appointment date so there is time.",
        },
        {
          question: "Will colour stain my bathroom?",
          answer:
            "No. We cover surfaces and floors before mixing, work over protective sheeting and take all waste with us.",
        },
      ],
    },
  },
  {
    slug: "balayage-highlights-at-home-dubai",
    name: "Highlights, Balayage, Babylights & Ombré",
    shortName: "balayage or highlights",
    promise: "Lightening placed for how you part it and how it grows out.",
    description:
      "Freehand balayage, foiled highlights, fine babylights and ombré, all with bond protection through the lightener. Placement is mapped to your parting and face shape so the grow-out stays wearable for months rather than weeks.",
    duration: "3 – 5 hrs",
    priceFrom: 550,
    image: "svc-highlights",
    page: {
      title: "Balayage & Highlights at Home in Dubai | SILQ",
      description:
        "Freehand balayage, babylights, highlights and ombré at home across Dubai. Bond-protected lightening by senior colourists. From AED 550.",
      h1: "Balayage and highlights at home in Dubai",
      lede: "Lightening is the most technical thing we do. It is also the thing most worth having done properly.",
      sections: [
        {
          heading: "Balayage, ombré, babylights — what you are actually choosing",
          paragraphs: [
            "Balayage is freehand: lightener painted on the surface of the hair so the result is soft at the root and strongest where the light would naturally hit. It grows out without a line, which is why it suits anyone who does not want a six-week appointment cycle.",
            "Babylights are fine, densely woven foils that mimic the way hair lightens naturally in childhood. They read as brightness rather than as stripes, and they are the right call when you want lift without obvious contrast.",
            "Ombré is a deliberate gradient with a visible transition, darker top to lighter ends. Traditional foiled highlights sit closer to the root and give more uniform, higher-contrast brightness. Most appointments end up as a combination — foils through the parting and around the face, freehand through the rest.",
          ],
        },
        {
          heading: "Placement is the whole job",
          paragraphs: [
            "Where the lightener goes matters more than which technique it is called. We map placement to your parting, because a section that sits underneath when you part left becomes the brightest piece when you part right. We build brightness around the face where it reads, and keep the nape quieter where nobody sees it.",
            "We also place for grow-out. Colour you have to fix in five weeks is not a saving. Placed properly, balayage looks intentional at three months and still acceptable at five.",
          ],
        },
        {
          heading: "Bond protection and honest limits",
          paragraphs: [
            "Every lightening service includes a bond-building additive mixed into the lightener, plus a post-service treatment. That is not an upsell line — lightening breaks disulfide bonds, and the additive is what lets us reach a usable level without the hair going gummy.",
            "There is still a limit. Hair that has been box-dyed dark, previously henna'd, or heavily heat-damaged will not reach a clean level nine in one session, and any stylist who tells you otherwise is planning to hand you back damaged hair. We will give you a staged plan and tell you where you will realistically be after visit one.",
            "Toner is included in the appointment and is what turns raw lift into a wearable shade. Expect to re-tone every eight to ten weeks; the lightening itself lasts far longer.",
          ],
        },
      ],
      faqs: [
        {
          question: "How long does a full balayage take?",
          answer:
            "Three to five hours depending on length and density, including the toner and treatment. Very long or very thick hair sits at the top of that range. We block the time properly rather than rushing the processing.",
        },
        {
          question: "Can you fix brassy or orange tones from a previous appointment?",
          answer:
            "Usually. Send a daylight photo when you enquire. Sometimes it is a toner correction in one visit, sometimes it needs additional lifting first, and we will tell you which before you book.",
        },
        {
          question: "I have box dye on my ends. Can you still lighten?",
          answer:
            "Often yes, but in stages, and the first session will get you partway. We test a strand before committing so you can see the honest starting point.",
        },
      ],
    },
  },
  {
    slug: "hair-treatments-at-home-dubai",
    name: "Hair Treatments",
    shortName: "a hair treatment",
    promise: "Repair chosen for the actual damage, not a menu item.",
    description:
      "Bond repair, deep conditioning, protein-moisture rebalancing and scalp treatments. We assess porosity and elasticity first, because protein on hair that needs moisture makes it worse, and the two failures look almost identical.",
    duration: "45 mins – 1.5 hrs",
    priceFrom: 200,
    image: "svc-treatment",
    page: {
      title: "Hair Treatments at Home in Dubai | Bond Repair & Deep Conditioning | SILQ",
      description:
        "Professional hair treatments at home in Dubai. Bond repair, deep conditioning, protein balancing and scalp care. From AED 200.",
      h1: "Hair treatments at home in Dubai",
      lede: "Dry, brittle and over-processed are three different problems. Treating them the same way is why most treatments disappoint.",
      sections: [
        {
          heading: "We diagnose before we treat",
          paragraphs: [
            "Hair that snaps when stretched wet needs protein. Hair that stretches, stays stretched and feels limp needs moisture. Hair that feels rough, tangles at the mid-lengths and drinks product needs the cuticle sealed. These present almost identically to the person living with them, and the wrong treatment makes each one measurably worse.",
            "We do a wet elasticity test and check porosity along the strand before choosing anything. It takes five minutes and it is the difference between a treatment that lasts six weeks and one that washes out on Tuesday.",
          ],
        },
        {
          heading: "What we offer",
          paragraphs: [
            "Bond repair rebuilds the internal disulfide bonds broken by lightening and heat. It is the right treatment after colour, and the one worth repeating as a standalone every few weeks if you lighten regularly.",
            "Deep conditioning restores moisture and slip to hair that has gone dry from sun, chlorine, hard water or air conditioning — all four of which Dubai supplies generously. Protein rebalancing suits fine hair that has lost structure and cannot hold a style.",
            "Scalp treatments address flaking, product build-up, oiliness and the itchiness that comes from wearing hair up in the heat. Healthy length starts at the scalp, and it is the part most treatment menus ignore.",
          ],
        },
        {
          heading: "Dubai-specific damage",
          paragraphs: [
            "The water here is hard. Mineral deposits build on the cuticle, dull colour and make hair feel coated no matter how much conditioner you use. A chelating treatment strips that build-up and it is often the single biggest visible improvement for someone who has lived here a few years.",
            "Chlorine and salt water are the other two. If you swim regularly, the fix is not a stronger conditioner but a barrier before you get in and a proper clarify after. We will show you the routine at the appointment — it takes about a minute a day and it saves the colour.",
          ],
        },
      ],
      faqs: [
        {
          question: "How often should I have a treatment?",
          answer:
            "For hair that is coloured or heat-styled regularly, every four to six weeks. For hair that is lightened, a bond treatment with every colour service plus one standalone in between.",
        },
        {
          question: "Can I add a treatment to a colour appointment?",
          answer:
            "Yes, and it is the most efficient way to book. Bond protection is already included in our lightening services; a deep conditioning or scalp treatment can be added on top.",
        },
        {
          question: "Will a treatment fix split ends?",
          answer:
            "No. Nothing does — a split end is a mechanical break and the only fix is to cut it. A treatment will improve everything above the split and slow the next one forming.",
        },
      ],
    },
  },
  {
    slug: "keratin-treatment-at-home-dubai",
    name: "Keratin & Protein",
    shortName: "a keratin treatment",
    promise: "Smoothing that survives a Dubai summer.",
    description:
      "Keratin and protein smoothing to cut frizz, reduce drying time and make hair manageable in humidity. Applied section by section and sealed with a flat iron, with formaldehyde-free options for anyone who wants them.",
    duration: "3 – 5 hrs",
    priceFrom: 750,
    image: "svc-keratin",
    page: {
      title: "Keratin Treatment at Home in Dubai | Frizz Smoothing | SILQ",
      description:
        "Professional keratin and protein smoothing at home across Dubai. Formaldehyde-free options, applied and sealed by senior stylists. From AED 750.",
      h1: "Keratin treatment at home in Dubai",
      lede: "Between the humidity off the Gulf and the air conditioning indoors, hair here is asked to survive two climates a day. Keratin is the practical answer.",
      sections: [
        {
          heading: "What keratin actually does",
          paragraphs: [
            "A keratin treatment coats and fills the hair shaft with a protein solution, which is then sealed in with a flat iron at controlled heat. The result is smoother cuticle, dramatically less frizz, and hair that dries faster and straighter than it naturally would.",
            "It is not a permanent straightener. It does not break and re-form the internal bonds the way a chemical relaxer does, which is why it grows out softly rather than leaving a hard line. Curly hair keeps some pattern — looser, smoother, far more manageable — rather than going poker straight.",
            "Expect three to five months depending on your hair type, how often you wash, and whether you use sulphate-free shampoo. Salt water and chlorine shorten it. Washing every day shortens it.",
          ],
        },
        {
          heading: "The appointment",
          paragraphs: [
            "Plan for three to five hours. Longer or denser hair sits at the upper end. The sequence is a clarifying wash to open the cuticle, a careful towel dry, application in thin sections, a rest period while the solution takes, a full blow-dry, then a slow flat-iron pass in very fine sections. That last pass is where the result is made or lost, and it cannot be hurried.",
            "We need good ventilation. Open a window or run the extractor — we will set up in whichever room ventilates best. Anyone pregnant or breastfeeding should choose the formaldehyde-free formula, and we will always ask.",
          ],
        },
        {
          heading: "Aftercare, and the one rule that matters",
          paragraphs: [
            "Do not wash, tie, clip or tuck your hair behind your ears for 48 hours after the treatment. A hair tie in the first two days leaves a permanent kink in the finished result. This is the most common reason a keratin appointment disappoints, and it is entirely avoidable.",
            "After that, switch to a sulphate-free and sodium-chloride-free shampoo. Ordinary supermarket shampoo strips the treatment measurably faster — you will lose a month or more. Rinse with fresh water after swimming.",
            "Colour and keratin cannot be done in the same visit. Colour first, keratin at least two weeks later, in that order. Doing both on the same day compromises both, and we will not schedule it.",
          ],
        },
      ],
      faqs: [
        {
          question: "How long does keratin last?",
          answer:
            "Three to five months for most people. Sulphate-free shampoo, less frequent washing and rinsing after the pool all extend it.",
        },
        {
          question: "Can I have colour and keratin on the same day?",
          answer:
            "No. Colour first, then keratin at least two weeks later. Combining them on one day compromises both results, so we book them as separate visits.",
        },
        {
          question: "Is there a formaldehyde-free option?",
          answer:
            "Yes, and we recommend it if you are pregnant, breastfeeding, sensitive to fumes, or simply prefer it. Ask when you enquire and we will bring it.",
        },
        {
          question: "Will it make my curly hair completely straight?",
          answer:
            "No. It loosens and smooths the pattern rather than removing it. If you want it straight you will still blow-dry, but it will take a fraction of the time and hold far better.",
        },
      ],
    },
  },
  {
    slug: "hair-botox-hair-spa-at-home-dubai",
    name: "Hair Botox & Hair Spa",
    shortName: "hair botox or a hair spa",
    promise: "Condition and shine without the commitment of smoothing.",
    description:
      "Hair botox fills and plumps damaged strands for body and gloss without relaxing the curl. Hair spa is a slower ritual — steam, massage, deep mask — for scalp health and stressed lengths. Neither changes your natural texture.",
    duration: "1.5 – 2.5 hrs",
    priceFrom: 250,
    image: "svc-botox-spa",
    page: {
      title: "Hair Botox & Hair Spa at Home in Dubai | SILQ",
      description:
        "Hair botox and hair spa treatments at home in Dubai. Deep conditioning, gloss and scalp care without changing your natural texture. From AED 250.",
      h1: "Hair botox and hair spa at home in Dubai",
      lede: "Two treatments people constantly confuse with keratin, and with each other. Here is the difference.",
      sections: [
        {
          heading: "Hair botox",
          paragraphs: [
            "There is no botulinum toxin in hair botox — the name is marketing. It is a deep filler treatment: a rich mask of proteins, amino acids and lipids that fills the gaps in a damaged cuticle, plumping the strand so it reflects more light and feels considerably denser.",
            "The distinction from keratin matters. Keratin smooths and relaxes the pattern; botox conditions without changing texture. Curly hair stays curly, just glossier, softer and less prone to frizz. If you love your curl but hate how dry it looks, this is the treatment, not keratin.",
            "Results last around four to eight weeks. It suits fine hair that would go limp under a keratin treatment, and it is a good option after lightening when the hair needs body back.",
          ],
        },
        {
          heading: "Hair spa",
          paragraphs: [
            "Hair spa is the slower one. A cleansing wash, a scalp massage worked properly through the roots, a deep mask left under steam so it penetrates, then a rinse and a blow-dry. It is as much about circulation and scalp health as it is about the lengths.",
            "It is the right choice for a scalp that is tight, flaky, oily or itchy from heat and hats, and for hair that is generally tired rather than specifically damaged. It is also the most genuinely restful ninety minutes on our list, which is not nothing when it happens in your own home.",
          ],
        },
        {
          heading: "Choosing between them",
          paragraphs: [
            "Frizz that gets worse in humidity, and you want less drying time: keratin. Dry, dull, damaged-looking lengths where you want to keep your texture: hair botox. Scalp problems, build-up or general tiredness: hair spa.",
            "If you are not sure, message us with a photo and what bothers you most about your hair right now. We will tell you which one actually addresses it, including when the answer is that none of them will and what you need instead.",
          ],
        },
      ],
      faqs: [
        {
          question: "Is hair botox the same as keratin?",
          answer:
            "No. Keratin smooths and loosens texture; hair botox conditions and fills without changing your curl pattern. Botox also washes out faster, in four to eight weeks.",
        },
        {
          question: "Will hair botox straighten my hair?",
          answer:
            "No. Your natural texture stays. It will look glossier and feel denser, and frizz will reduce, but the curl remains.",
        },
        {
          question: "Can I have a hair spa on the same day as a haircut?",
          answer:
            "Yes. Spa first, cut after, and we allow the combined time when you book both together.",
        },
      ],
    },
  },
  {
    slug: "hair-styling-updos-at-home-dubai",
    name: "Styling, Updos & Retro Waves",
    shortName: "styling or an updo",
    promise: "Set at home, arrives intact.",
    description:
      "Blow-dries, occasion updos, bridal hair and old-Hollywood waves, built to survive the drive and the evening. We work to your dress, your neckline and how the room will be lit, and we can start early enough for a morning ceremony.",
    duration: "45 mins – 2.5 hrs",
    priceFrom: 180,
    image: "svc-styling",
    page: {
      title: "Hair Styling, Updos & Bridal Hair at Home in Dubai | SILQ",
      description:
        "Blow-dries, occasion updos, retro waves and bridal hair at home across Dubai. Early starts available. From AED 180.",
      h1: "Styling, updos and retro waves at home in Dubai",
      lede: "The advantage of having your hair done at home is that it is finished when you leave, not after twenty minutes in a car.",
      sections: [
        {
          heading: "Blow-dries and everyday styling",
          paragraphs: [
            "A professional blow-dry is a different object from a home one: smoother root lift, a cleaner finish through the mid-lengths, and it holds for two or three days rather than collapsing by evening. Bouncy, sleek, or worked into a soft wave — tell us which and we will build it.",
            "We bring professional dryers, brushes and irons. Product is included and chosen for your hair type rather than whatever is under your sink.",
          ],
        },
        {
          heading: "Occasion and bridal",
          paragraphs: [
            "For an event we want three things in advance: a photo of the dress or at least the neckline, the venue, and the time you need to leave. A high chignon with a high neckline fights itself, and a style built for daylight photographs reads flat under warm evening light. These are solvable problems if we know early.",
            "Bridal is booked with a trial. The trial is where we test how your hair holds in real conditions, agree the shape, and time the whole thing properly so the morning is not a rush. We can start before sunrise for a morning ceremony, and we can stay to pin a veil and re-set for the reception.",
            "Retro waves — proper finger-waved, pin-set old-Hollywood — need setting time and are worth booking with an extra hour. Set at home and left to cool properly, they last the whole evening. Set in a salon and driven across town, they rarely do.",
          ],
        },
        {
          heading: "Making it last",
          paragraphs: [
            "We finish with the humidity in mind. Dubai evenings move between air-conditioned interiors and warm outdoor terraces, and a style that only holds in one of those is half a style. That means flexible hold rather than lacquer, pins placed against the direction of the fall, and a structure that can take being touched.",
            "We will leave you a couple of matched pins and show you the one adjustment to make if anything shifts. Most of the time nothing does.",
          ],
        },
      ],
      faqs: [
        {
          question: "How early can you start for a wedding?",
          answer:
            "As early as needed, including before sunrise. Confirm the timing at the trial so we can plan the sequence properly.",
        },
        {
          question: "Do you do bridal trials?",
          answer:
            "Yes, and for bridal we require one. It is the only reliable way to know how your hair holds and how long the finished style will take on the day.",
        },
        {
          question: "Can you style hair extensions or add hairpieces?",
          answer:
            "Yes. Bring them out before we start so we can match placement and colour into the shape.",
        },
      ],
    },
  },
  {
    slug: "threading-at-home-dubai",
    name: "Brow & Face Threading",
    shortName: "threading",
    promise: "The one thing we do that is not hair.",
    description:
      "Precise cotton-thread shaping for brows, upper lip and face, mapped to your bone structure rather than to a trend. Added to any hair appointment for a few extra minutes, or booked on its own.",
    duration: "15 – 30 mins",
    priceFrom: 40,
    image: "svc-threading",
    page: {
      title: "Eyebrow Threading at Home in Dubai | SILQ",
      description:
        "Precise brow and face threading at home in Dubai. Book on its own or add it to any hair appointment. From AED 40.",
      h1: "Brow and face threading at home in Dubai",
      lede: "We do hair. Threading is the single exception, because everybody asks and it takes fifteen minutes.",
      sections: [
        {
          heading: "Why threading",
          paragraphs: [
            "A cotton thread removes a whole row of hair at once, from the root, along a line you can control to the millimetre. That precision is why it beats waxing for brows — you can take a single row from the underside of an arch without lifting the skin around it.",
            "It is also gentler on the skin than wax. No heat, no adhesive, nothing pulled off the surface. That makes it viable for anyone using retinol or acids, where waxing is genuinely risky, though we still ask you to pause actives for a couple of days beforehand.",
          ],
        },
        {
          heading: "Shaping",
          paragraphs: [
            "We map the brow to your face before we start: where the front should sit relative to the inner eye, where the arch falls against the bone, and where the tail should end so it lifts rather than drags. Then we agree it with you, in a mirror, before any hair is removed.",
            "Brows are not symmetrical and chasing symmetry is how people end up with two thin ones. We shape to balance, working with the bone, and we take less than you expect on the first visit. It is always possible to remove more at the next appointment. It is not possible to put it back.",
          ],
        },
        {
          heading: "Booked on its own or added on",
          paragraphs: [
            "Threading takes fifteen to thirty minutes depending on how much of the face is included — brows alone, or brows with upper lip, chin and sides. Adding it to a colour or keratin appointment costs you almost no extra time, since there is processing time to use.",
            "Booked on its own, it is a short visit and we price it accordingly. Several people in one household can be done in the same visit, which is how most of our threading appointments actually run.",
          ],
        },
      ],
      faqs: [
        {
          question: "Does threading hurt?",
          answer:
            "Less than waxing for most people, and it is over quickly. The first appointment is the most noticeable; regular maintenance is easier.",
        },
        {
          question: "Can I book threading on its own?",
          answer:
            "Yes. It is a short visit, and it is often booked for two or three people in the same household at once.",
        },
        {
          question: "I use retinol. Is threading safe?",
          answer:
            "Generally yes, and it is safer than waxing. Pause retinol and acids for two days before and tell us when we arrive.",
        },
      ],
    },
  },
];

export const getService = (slug: string): Service | undefined =>
  SERVICES.find((service) => service.slug === slug);

// A fictional show and a fictional social feed, so the demo works without any real IP.

export const DEMO_TITLE = 'The Ninth Lantern';

export const DEMO_GUIDE = `The Ninth Lantern — Season 1 (8 episodes). Fictional coastal mystery drama.
Main characters: Mara Vell (new lighthouse keeper of the ninth lantern on the Isle of Corrow), Tibb (orphan apprentice), Captain Oren Hask (harbor captain), Lady Seline Arkwright (governor of Corrow), the Drowned Choir (a secret cult).
Ep 1 "Arrival": Mara arrives on Corrow to keep the ninth lantern. She meets Tibb. A merchant ship wrecks on the reef.
Ep 2 "Survivors": Captain Oren Hask rescues survivors. Mara finds a strange hymn sheet in the wreck.
Ep 3 "Dark Water": Lady Seline bans night sailing. The ninth lantern goes dark for the first time. Tibb goes missing.
Ep 4 "The Caves": Tibb is found alive in the sea caves. He reveals that the Drowned Choir sings ships onto the rocks.
Ep 5 "Hymn": Twist — Captain Oren Hask is the leader of the Drowned Choir.
Ep 6 "Blood": Lady Seline is revealed to be Mara's mother.
Ep 7 "Collapse": The lantern tower collapses; Tibb dies saving Mara.
Ep 8 "Relight" (finale): Mara relights the lantern by singing the Choir's hymn backwards; Oren Hask drowns; Mara becomes governor of Corrow.`;

export interface DemoPost {
  user: string;
  handle: string;
  text: string;
  /** Ground truth for the demo scoreboard: the latest episode this post reveals (0 = reveals nothing). */
  reveals: number;
}

export const DEMO_POSTS: DemoPost[] = [
  { user: 'Kettle & Crumb', handle: 'kettlecrumb', text: 'New sourdough starter is finally alive. Named it Gerald.', reveals: 0 },
  { user: 'Harbor Watch Club', handle: 'harborwatch', text: 'Rewatching episode 1 of The Ninth Lantern and the shipwreck on the reef still looks incredible. Mara arriving on Corrow in the fog, chef\'s kiss.', reveals: 0 },
  { user: 'lantern_fan_88', handle: 'lanternfan88', text: 'OREN HASK IS THE CHOIR LEADER?!?! I trusted that man with my whole heart #NinthLantern', reveals: 5 },
  { user: 'Daily Commute', handle: 'commutelog', text: 'Train delayed again. Third time this week.', reveals: 0 },
  { user: 'TV Weekly', handle: 'tvweekly', text: 'The Ninth Lantern has been renewed for a second season, with filming set to begin in spring.', reveals: 0 },
  { user: 'ゆき', handle: 'yuki_tv', text: 'ナインス・ランタン7話、ティブが…ティブがマーラをかばって…塔の下敷きに。もう無理。', reveals: 7 },
  { user: 'Mara Vell Stan', handle: 'maravellstan', text: 'Mara finding that hymn sheet in the wreck is such a good hook. What is it for??', reveals: 0 },
  { user: 'Plot Hole Patrol', handle: 'plotholepatrol', text: 'So Seline is literally Mara\'s mum and nobody on Corrow noticed the resemblance for 20 years? Come on.', reveals: 6 },
  { user: 'Weekend Hikes', handle: 'weekendhikes', text: 'Coastal trail this morning. Found a lighthouse that looks exactly like the one in that lantern show.', reveals: 0 },
  { user: 'Corrow Theories', handle: 'corrowtheories', text: 'Theory: Tibb didn\'t just get lost in ep 3. Somebody took him. Watch the background of the harbor scene.', reveals: 0 },
  { user: 'Sea Caves Enjoyer', handle: 'seacaves', text: 'Ep 4 of Ninth Lantern: Tibb is ALIVE and the Drowned Choir is singing ships onto the rocks. Chills.', reveals: 4 },
  { user: 'ランタン考察', handle: 'lantern_kousatsu', text: 'セリーヌ総督の夜間航行禁止、3話の時点で怪しすぎる。何か隠してる顔。', reveals: 0 },
  { user: 'Finale Night', handle: 'finalenight', text: 'Mara singing the hymn BACKWARDS to relight the lantern. Governor Mara. Perfect ending. Oren got what he deserved.', reveals: 8 },
  { user: 'Coffee Notes', handle: 'coffeenotes', text: 'Trying a new pour-over ratio: 1:16. Brighter, less bitter.', reveals: 0 },
  { user: 'Casting Desk', handle: 'castingdesk', text: 'The actor who plays Captain Oren Hask will be at the fan convention next month.', reveals: 0 },
  { user: 'quiet viewer', handle: 'quietviewer', text: 'Not saying anything but... keep an eye on who is always first at every wreck in The Ninth Lantern 👀', reveals: 5 },
  { user: 'Lantern Memes', handle: 'lanternmemes', text: 'Me every time the ninth lantern goes dark: 🕯️➡️🌑😱', reveals: 0 },
  { user: 'Book Club', handle: 'bookclub', text: 'Finished a great mystery novel this weekend. No spoilers, but the ending got me.', reveals: 0 },
  { user: 'まりな', handle: 'marina_drama', text: 'ナインス・ランタン最終回、オーレン船長が溺れて終わるのスッキリした！マーラ総督おめでとう', reveals: 8 },
  { user: 'Episode Rankings', handle: 'eprankings', text: 'Ranking every Ninth Lantern episode so far: ep 2 > ep 1 > ep 3. The survivors episode is underrated.', reveals: 0 },
];

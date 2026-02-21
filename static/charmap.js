document.addEventListener('DOMContentLoaded', function () {
    // ── Emoji Data ──
    var EMOJI = [
        { cat: 'Smileys', items: [
            ['😀','grinning face'],['😃','smiley face big eyes'],['😄','grinning face smiling eyes'],['😁','beaming face'],['😆','grinning squinting'],['😅','grinning sweat'],['🤣','rolling laughing'],['😂','face tears joy'],['🙂','slightly smiling'],['🙃','upside down face'],['😉','winking face'],['😊','smiling blushing'],['😇','smiling halo angel'],['🥰','smiling hearts love'],['😍','heart eyes'],['🤩','star struck'],['😘','face blowing kiss'],['😗','kissing face'],['😚','kissing closed eyes'],['😙','kissing smiling eyes'],['🥲','smiling tear'],['😋','face savoring food yum'],['😛','face tongue'],['😜','winking tongue'],['🤪','zany face crazy'],['😝','squinting tongue'],['🤑','money mouth face'],['🤗','hugging face'],['🤭','face hand over mouth'],['🤫','shushing face quiet'],['🤔','thinking face hmm'],['🫡','saluting face'],['🤐','zipper mouth face'],['🤨','face raised eyebrow'],['😐','neutral face'],['😑','expressionless'],['😶','face without mouth'],['🫥','dotted line face hidden'],['😏','smirking face'],['😒','unamused face'],['🙄','rolling eyes'],['😬','grimacing face'],['🤥','lying face pinocchio'],['😌','relieved face'],['😔','pensive face sad'],['😪','sleepy face'],['🤤','drooling face'],['😴','sleeping face zzz'],['😷','face mask sick'],['🤒','face thermometer fever'],['🤕','face bandage hurt'],['🤢','nauseated face sick'],['🤮','vomiting face'],['🥵','hot face'],['🥶','cold face freezing'],['🥴','woozy face drunk'],['😵','face spiral dizzy'],['🤯','exploding head mind blown'],['🤠','cowboy hat face'],['🥳','partying face celebration'],['🥸','disguised face'],['😎','sunglasses cool'],['🤓','nerd face glasses'],['🧐','monocle face'],['😕','confused face'],['🫤','face diagonal mouth'],['😟','worried face'],['🙁','slightly frowning'],['😮','face open mouth'],['😯','hushed face'],['😲','astonished face'],['😳','flushed face'],['🥺','pleading face puppy eyes'],['🥹','face holding back tears'],['😦','frowning open mouth'],['😧','anguished face'],['😨','fearful face scared'],['😰','anxious sweat'],['😥','sad relieved'],['😢','crying face'],['😭','loudly crying'],['😱','screaming fear'],['😖','confounded face'],['😣','persevering face'],['😞','disappointed face'],['😓','downcast sweat'],['😩','weary face tired'],['😫','tired face'],['🥱','yawning face bored'],['😤','face steam nose angry'],['😡','pouting face red angry'],['😠','angry face'],['🤬','face symbols mouth swearing'],['💀','skull dead'],['☠️','skull crossbones'],['💩','pile poo'],['🤡','clown face'],['👹','ogre'],['👺','goblin'],['👻','ghost'],['👽','alien'],['👾','alien monster'],['🤖','robot face'],['💋','kiss mark lips'],['💯','hundred points perfect'],['💢','anger symbol'],['💥','collision boom'],['💫','dizzy star'],['💦','sweat droplets'],['💨','dashing away wind'],['🕳️','hole'],['❤️','red heart love'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['🤎','brown heart'],['💔','broken heart'],['❤️‍🔥','heart fire'],['💕','two hearts'],['💞','revolving hearts'],['💓','beating heart'],['💗','growing heart'],['💖','sparkling heart'],['💘','heart arrow cupid'],['💝','heart ribbon gift'],['💟','heart decoration'],['🫶','heart hands'],
        ]},
        { cat: 'Hands', items: [
            ['👋','waving hand hello'],['🤚','raised back hand'],['🖐️','hand splayed fingers'],['✋','raised hand stop'],['🖖','vulcan salute spock'],['🫱','rightwards hand'],['🫲','leftwards hand'],['🫳','palm down hand'],['🫴','palm up hand'],['🫷','leftwards pushing hand'],['🫸','rightwards pushing hand'],['👌','ok hand'],['🤌','pinched fingers italian'],['🤏','pinching hand small'],['✌️','victory peace sign'],['🤞','crossed fingers luck'],['🫰','hand index thumb crossed'],['🤟','love you gesture'],['🤘','sign horns rock'],['🤙','call me hand'],['👈','pointing left'],['👉','pointing right'],['👆','pointing up'],['🖕','middle finger'],['👇','pointing down'],['☝️','index pointing up'],['🫵','index pointing viewer'],['👍','thumbs up like'],['👎','thumbs down dislike'],['✊','raised fist'],['👊','fist bump'],['🤛','left fist bump'],['🤜','right fist bump'],['👏','clapping hands bravo'],['🙌','raising hands celebrate'],['🫶','heart hands love'],['👐','open hands'],['🤲','palms up together'],['🤝','handshake deal'],['🙏','folded hands pray please thanks'],['✍️','writing hand'],['💪','flexed biceps strong'],['🦾','mechanical arm prosthetic'],['🦿','mechanical leg'],
        ]},
        { cat: 'People', items: [
            ['👶','baby'],['🧒','child'],['👦','boy'],['👧','girl'],['🧑','person adult'],['👱','blond hair person'],['👨','man'],['👩','woman'],['🧔','person beard'],['👴','old man'],['👵','old woman'],['🙍','person frowning'],['🙎','person pouting'],['🙅','person no'],['🙆','person ok gesture'],['💁','person tipping hand'],['🙋','person raising hand'],['🧏','deaf person'],['🙇','person bowing'],['🤦','person facepalm'],['🤷','person shrugging idk'],['👮','police officer cop'],['🕵️','detective spy'],['💂','guard'],['🥷','ninja'],['👷','construction worker'],['🤴','prince'],['👸','princess'],['👳','person turban'],['👲','person cap'],['🧕','woman headscarf hijab'],['🤵','person tuxedo'],['👰','person veil bride'],['🤰','pregnant woman'],['👼','baby angel'],['🎅','santa claus christmas'],['🤶','mrs claus'],['🦸','superhero'],['🦹','supervillain'],['🧙','mage wizard'],['🧚','fairy'],['🧛','vampire'],['🧜','merperson'],['🧝','elf'],['🧞','genie'],['🧟','zombie'],
        ]},
        { cat: 'Animals', items: [
            ['🐶','dog face puppy'],['🐱','cat face kitten'],['🐭','mouse face'],['🐹','hamster face'],['🐰','rabbit face bunny'],['🦊','fox face'],['🐻','bear face'],['🐼','panda face'],['🐨','koala'],['🐯','tiger face'],['🦁','lion face'],['🐮','cow face'],['🐷','pig face'],['🐸','frog face'],['🐵','monkey face'],['🙈','see no evil monkey'],['🙉','hear no evil monkey'],['🙊','speak no evil monkey'],['🐒','monkey'],['🦍','gorilla'],['🦧','orangutan'],['🐔','chicken'],['🐧','penguin'],['🐦','bird'],['🐤','baby chick'],['🦆','duck'],['🦅','eagle'],['🦉','owl'],['🦇','bat'],['🐺','wolf face'],['🐗','boar'],['🐴','horse face'],['🦄','unicorn'],['🐝','honeybee'],['🐛','bug caterpillar'],['🦋','butterfly'],['🐌','snail'],['🐞','ladybug'],['🐜','ant'],['🪲','beetle'],['🪳','cockroach'],['🕷️','spider'],['🦂','scorpion'],['🐢','turtle'],['🐍','snake'],['🦎','lizard'],['🐙','octopus'],['🦑','squid'],['🦐','shrimp'],['🦀','crab'],['🐡','blowfish'],['🐠','tropical fish'],['🐟','fish'],['🐬','dolphin'],['🐳','whale'],['🦈','shark'],['🐊','crocodile'],['🐅','tiger'],['🐆','leopard'],['🦓','zebra'],['🦏','rhinoceros'],['🐘','elephant'],['🦛','hippopotamus'],['🐪','camel'],['🐫','two hump camel'],['🦒','giraffe'],['🦘','kangaroo'],['🐃','water buffalo'],['🐂','ox'],['🐄','cow'],['🐎','horse racing'],['🐖','pig'],['🐏','ram sheep'],['🐑','ewe sheep'],['🦙','llama alpaca'],['🐐','goat'],['🐓','rooster'],['🦃','turkey'],['🦚','peacock'],['🦜','parrot'],['🦢','swan'],['🕊️','dove peace'],['🐇','rabbit'],['🐁','mouse'],['🐀','rat'],['🐿️','chipmunk squirrel'],['🦔','hedgehog'],['🐾','paw prints'],['🐉','dragon'],['🦕','dinosaur sauropod'],['🦖','t-rex dinosaur'],
        ]},
        { cat: 'Food', items: [
            ['🍎','red apple'],['🍐','pear'],['🍊','tangerine orange'],['🍋','lemon'],['🍌','banana'],['🍉','watermelon'],['🍇','grapes'],['🍓','strawberry'],['🫐','blueberries'],['🍈','melon'],['🍒','cherries'],['🍑','peach'],['🥭','mango'],['🍍','pineapple'],['🥥','coconut'],['🥝','kiwi fruit'],['🍅','tomato'],['🍆','eggplant aubergine'],['🥑','avocado'],['🥦','broccoli'],['🥬','leafy green'],['🥒','cucumber'],['🌶️','hot pepper chili'],['🫑','bell pepper'],['🌽','ear corn'],['🥕','carrot'],['🧄','garlic'],['🧅','onion'],['🥔','potato'],['🍠','sweet potato'],['🥐','croissant'],['🥯','bagel'],['🍞','bread'],['🥖','baguette french bread'],['🥨','pretzel'],['🧀','cheese wedge'],['🍳','cooking egg fried'],['🧈','butter'],['🥞','pancakes'],['🧇','waffle'],['🥓','bacon'],['🥩','cut meat steak'],['🍗','poultry leg chicken'],['🍖','meat bone'],['🌭','hot dog'],['🍔','hamburger burger'],['🍟','french fries'],['🍕','pizza slice'],['🥪','sandwich'],['🌮','taco'],['🌯','burrito'],['🫔','tamale'],['🥗','green salad'],['🥘','cooking pot stew'],['🫕','fondue'],['🍝','spaghetti pasta'],['🍜','steaming bowl ramen noodle'],['🍲','pot food'],['🍛','curry rice'],['🍣','sushi'],['🍱','bento box'],['🥟','dumpling'],['🦪','oyster'],['🍤','fried shrimp tempura'],['🍙','rice ball onigiri'],['🍚','cooked rice'],['🍘','rice cracker'],['🍧','shaved ice'],['🍨','ice cream'],['🍦','soft ice cream cone'],['🥧','pie'],['🧁','cupcake'],['🍰','shortcake'],['🎂','birthday cake'],['🍮','custard pudding'],['🍭','lollipop'],['🍬','candy'],['🍫','chocolate bar'],['🍿','popcorn'],['🍩','doughnut donut'],['🍪','cookie'],['☕','hot beverage coffee tea'],['🍵','teacup'],['🧃','beverage box juice'],['🥤','cup straw'],['🧋','bubble tea boba'],['🍶','sake'],['🍺','beer mug'],['🍻','clinking beers cheers'],['🥂','clinking glasses champagne'],['🍷','wine glass'],['🥃','tumbler glass whisky'],['🍸','cocktail glass martini'],['🍹','tropical drink'],['🧉','mate'],['🍾','bottle popping cork'],['🫖','teapot'],['🧊','ice cube'],
        ]},
        { cat: 'Travel', items: [
            ['🚗','car automobile'],['🚕','taxi cab'],['🚙','sport utility vehicle suv'],['🚌','bus'],['🚎','trolleybus'],['🏎️','racing car formula'],['🚓','police car'],['🚑','ambulance'],['🚒','fire engine truck'],['🚐','minibus van'],['🛻','pickup truck'],['🚚','delivery truck'],['🚛','articulated lorry'],['🚜','tractor farm'],['🏍️','motorcycle'],['🛵','motor scooter'],['🚲','bicycle bike'],['🛴','kick scooter'],['🚂','locomotive train'],['🚆','train'],['🚇','metro subway'],['🚈','light rail'],['🚊','tram'],['🚉','station'],['✈️','airplane'],['🛫','airplane departure'],['🛬','airplane arrival'],['🚀','rocket space'],['🛸','flying saucer ufo'],['🚁','helicopter'],['🛶','canoe kayak'],['⛵','sailboat'],['🚤','speedboat'],['🛳️','passenger ship cruise'],['⛴️','ferry'],['🚢','ship'],['⚓','anchor'],['🗼','tokyo tower'],['🗽','statue liberty'],['🗿','moai easter island'],['🏰','castle european'],['🏯','japanese castle'],['🏟️','stadium'],['🎡','ferris wheel'],['🎢','roller coaster'],['🎠','carousel'],['⛲','fountain'],['⛱️','umbrella beach'],['🏖️','beach'],['🏝️','desert island'],['🏜️','desert'],['🌋','volcano'],['⛰️','mountain'],['🏔️','snow mountain'],['🗻','mount fuji'],['🏕','camping tent'],['🏠','house'],['🏢','office building'],['🏥','hospital'],['🏦','bank'],['🏨','hotel'],['🏪','convenience store'],['🏫','school'],['🏬','department store'],['🏭','factory'],['⛪','church'],['🕌','mosque'],['🕍','synagogue'],['🗾','map japan'],['🌍','globe earth europe africa'],['🌎','globe earth americas'],['🌏','globe earth asia australia'],['🌐','globe meridians'],['🗺️','world map'],
        ]},
        { cat: 'Objects', items: [
            ['⌚','watch time'],['📱','mobile phone smartphone'],['📲','mobile arrow call'],['💻','laptop computer'],['⌨️','keyboard'],['🖥️','desktop computer monitor'],['🖨️','printer'],['🖱️','computer mouse'],['🖲️','trackball'],['💽','computer disk minidisc'],['💾','floppy disk save'],['💿','optical disk cd'],['📀','dvd'],['🔌','electric plug power'],['🔋','battery'],['📷','camera photo'],['📹','video camera'],['📺','television tv'],['📻','radio'],['📞','telephone receiver'],['☎️','telephone'],['📟','pager'],['📠','fax machine'],['🔧','wrench tool'],['🔨','hammer'],['🛠️','hammer wrench tools'],['🔩','nut bolt screw'],['⚙️','gear settings'],['🔑','key'],['🗝️','old key'],['🔒','locked padlock'],['🔓','unlocked padlock'],['📎','paperclip'],['🖇️','linked paperclips'],['📏','straight ruler'],['📐','triangular ruler'],['✂️','scissors cut'],['📌','pushpin'],['📍','round pushpin location pin'],['🔗','link chain url'],['📝','memo note write'],['📁','file folder'],['📂','open file folder'],['📅','calendar date'],['📆','tear off calendar'],['📊','bar chart graph'],['📈','chart increasing'],['📉','chart decreasing'],['🗃️','card file box'],['🗄️','file cabinet'],['🗑️','wastebasket trash delete'],['📬','mailbox'],['📮','postbox'],['📧','email'],['📨','incoming envelope'],['📩','envelope arrow'],['💡','light bulb idea'],['🔦','flashlight'],['🕯️','candle'],['📖','open book'],['📚','books library'],['📰','newspaper'],['🏷️','label tag'],['💰','money bag'],['🪙','coin'],['💵','dollar banknote'],['💴','yen banknote'],['💶','euro banknote'],['💷','pound banknote'],['💳','credit card'],['💎','gem diamond'],['🎁','wrapped gift present'],['🏆','trophy winner'],['🥇','gold medal first'],['🥈','silver medal second'],['🥉','bronze medal third'],['🎮','video game controller'],['🕹️','joystick'],['🎲','game die dice'],['♟️','chess pawn'],['🎯','bullseye target dart'],['🎵','musical note'],['🎶','musical notes'],['🎸','guitar'],['🎹','musical keyboard piano'],['🎺','trumpet'],['🎻','violin'],['🥁','drum'],['🔔','bell notification'],['🔕','bell slash mute'],['📣','megaphone'],['📢','loudspeaker'],['🔊','speaker high volume'],['🔇','speaker muted'],
        ]},
        { cat: 'Symbols', items: [
            ['✅','check mark done'],['❌','cross mark wrong'],['❓','question mark red'],['❗','exclamation mark'],['‼️','double exclamation'],['⁉️','exclamation question'],['⚠️','warning sign'],['🚫','prohibited forbidden'],['⛔','no entry stop'],['🔴','red circle'],['🟠','orange circle'],['🟡','yellow circle'],['🟢','green circle'],['🔵','blue circle'],['🟣','purple circle'],['⚫','black circle'],['⚪','white circle'],['🟤','brown circle'],['🔺','red triangle up'],['🔻','red triangle down'],['🔶','large orange diamond'],['🔷','large blue diamond'],['🔸','small orange diamond'],['🔹','small blue diamond'],['▪️','black small square'],['▫️','white small square'],['◾','black medium small square'],['◽','white medium small square'],['◼️','black medium square'],['◻️','white medium square'],['⬛','black large square'],['⬜','white large square'],['💠','diamond dot'],['🔘','radio button'],['🔳','white square button'],['🔲','black square button'],['🏁','checkered flag finish'],['🚩','triangular flag red'],['🎌','crossed flags'],['🏳️','white flag'],['🏴','black flag'],['🏳️‍🌈','rainbow flag pride lgbtq'],['♻️','recycling recycle'],['✳️','eight spoked asterisk'],['❇️','sparkle'],['🔱','trident emblem'],['📛','name badge'],['🔰','beginner japanese'],['⭐','star yellow'],['🌟','glowing star'],['💫','dizzy star'],['✨','sparkles'],['☀️','sun'],['🌙','crescent moon'],['⭕','hollow circle'],['♈','aries zodiac'],['♉','taurus zodiac'],['♊','gemini zodiac'],['♋','cancer zodiac'],['♌','leo zodiac'],['♍','virgo zodiac'],['♎','libra zodiac'],['♏','scorpio zodiac'],['♐','sagittarius zodiac'],['♑','capricorn zodiac'],['♒','aquarius zodiac'],['♓','pisces zodiac'],['⛎','ophiuchus zodiac'],['♀️','female sign woman'],['♂️','male sign man'],['⚧️','transgender symbol'],['☮️','peace symbol'],['☯️','yin yang'],['♾️','infinity'],['🔄','counterclockwise arrows repeat'],['🔃','clockwise arrows'],['⬆️','arrow up'],['⬇️','arrow down'],['⬅️','arrow left'],['➡️','arrow right'],['↗️','arrow upper right'],['↘️','arrow lower right'],['↙️','arrow lower left'],['↖️','arrow upper left'],['↕️','arrow up down'],['↔️','arrow left right'],['🔀','shuffle tracks'],['🔁','repeat'],['🔂','repeat single'],['▶️','play button'],['⏸️','pause button'],['⏹️','stop button'],['⏺️','record button'],['⏭️','next track'],['⏮️','previous track'],['⏩','fast forward'],['⏪','rewind'],['🔼','upwards button'],['🔽','downwards button'],['ℹ️','information'],['🆗','ok button'],['🆕','new button'],['🆓','free button'],['🆒','cool button'],['🆙','up button'],['🈁','japanese here button'],['🔠','latin uppercase'],['🔡','latin lowercase'],['🔢','numbers input'],['#️⃣','hash pound sign'],['*️⃣','asterisk keycap'],['0️⃣','zero keycap'],['1️⃣','one keycap'],['2️⃣','two keycap'],['3️⃣','three keycap'],['4️⃣','four keycap'],['5️⃣','five keycap'],['6️⃣','six keycap'],['7️⃣','seven keycap'],['8️⃣','eight keycap'],['9️⃣','nine keycap'],['🔟','keycap ten'],
        ]},
    ];

    // ── Special Characters Data ──
    var CHARMAP = [
        { cat: 'Currency', items: [
            ['$','dollar sign'],['€','euro sign'],['£','pound sign sterling'],['¥','yen yuan sign'],['₩','won sign korean'],['₹','indian rupee sign'],['₽','ruble sign russian'],['₿','bitcoin sign crypto'],['¢','cent sign'],['₺','turkish lira sign'],['₴','hryvnia sign ukrainian'],['₸','tenge sign kazakh'],['₫','dong sign vietnamese'],['₱','peso sign philippine'],['฿','baht sign thai'],['₡','colon sign'],['₢','cruzeiro sign'],['₣','french franc sign'],['₤','lira sign'],['₥','mill sign'],['₦','naira sign nigerian'],['₧','peseta sign'],['₨','rupee sign'],['₪','new sheqel sign israeli'],['₭','kip sign lao'],['₮','tugrik sign mongolian'],['₯','drachma sign greek'],['¤','currency sign general'],
        ]},
        { cat: 'Math', items: [
            ['+','plus sign'],['−','minus sign'],['×','multiplication sign'],['÷','division sign'],['=','equals sign'],['≠','not equal to'],['≈','almost equal approximately'],['≡','identical to'],['≤','less than or equal'],['≥','greater than or equal'],['<','less than'],['> ','greater than'],['±','plus minus sign'],['∓','minus plus sign'],['∞','infinity'],['√','square root radical'],['∛','cube root'],['∜','fourth root'],['∑','summation sigma'],['∏','product pi'],['∫','integral'],['∂','partial differential'],['∆','delta increment'],['∇','nabla del'],['∈','element of'],['∉','not element of'],['∋','contains as member'],['⊂','subset of'],['⊃','superset of'],['⊆','subset or equal'],['⊇','superset or equal'],['∪','union'],['∩','intersection'],['∧','logical and'],['∨','logical or'],['¬','not sign negation'],['∀','for all'],['∃','there exists'],['∅','empty set null'],['∝','proportional to'],['∠','angle'],['⊥','perpendicular'],['∥','parallel to'],['≅','congruent to'],['∼','tilde similar to'],['⊕','circled plus xor'],['⊗','circled times'],['⊘','circled division'],['ƒ','function f'],['′','prime'],['″','double prime'],['‰','per mille permille'],['‱','per ten thousand'],['π','pi'],['∘','ring operator degree'],['·','middle dot'],['°','degree sign'],['%','percent sign'],
        ]},
        { cat: 'Arrows', items: [
            ['←','leftwards arrow'],['→','rightwards arrow'],['↑','upwards arrow'],['↓','downwards arrow'],['↔','left right arrow'],['↕','up down arrow'],['↗','north east arrow'],['↘','south east arrow'],['↙','south west arrow'],['↖','north west arrow'],['⇐','leftwards double arrow'],['⇒','rightwards double arrow implies'],['⇑','upwards double arrow'],['⇓','downwards double arrow'],['⇔','left right double arrow iff'],['⇕','up down double arrow'],['↩','leftwards arrow hook return'],['↪','rightwards arrow hook'],['↰','upwards arrow leftwards'],['↱','upwards arrow rightwards'],['↲','downwards arrow leftwards'],['↳','downwards arrow rightwards'],['↵','downwards arrow corner carriagereturn enter'],['↶','anticlockwise arc arrow undo'],['↷','clockwise arc arrow redo'],['⟵','long leftwards arrow'],['⟶','long rightwards arrow'],['⟷','long left right arrow'],['➔','heavy rightwards arrow'],['➜','heavy right arrow'],['➡','black rightwards arrow'],['⬅','leftwards black arrow'],['⬆','upwards black arrow'],['⬇','downwards black arrow'],['▲','black up pointing triangle'],['▼','black down pointing triangle'],['◀','black left pointing triangle'],['▶','black right pointing triangle'],['►','black right pointing pointer'],['◄','black left pointing pointer'],['⏎','return symbol enter'],
        ]},
        { cat: 'Punctuation', items: [
            ['\u201C','left double quotation mark'],['\u201D','right double quotation mark'],['\u2018','left single quotation mark'],['\u2019','right single quotation mark'],['«','left double angle bracket guillemet'],['»','right double angle bracket guillemet'],['‹','single left angle quotation'],['›','single right angle quotation'],['—','em dash long dash'],['–','en dash short dash'],['…','horizontal ellipsis dots'],['•','bullet point'],['‣','triangular bullet'],['·','middle dot interpunct'],['§','section sign'],['¶','pilcrow paragraph sign'],['†','dagger'],['‡','double dagger'],['※','reference mark'],['‽','interrobang'],['¡','inverted exclamation mark'],['¿','inverted question mark'],['⁂','asterism'],['※','reference mark'],['′','prime minutes feet'],['″','double prime seconds inches'],['‴','triple prime'],
        ]},
        { cat: 'Latin Extended', items: [
            ['À','A grave'],['Á','A acute'],['Â','A circumflex'],['Ã','A tilde'],['Ä','A umlaut diaeresis'],['Å','A ring above'],['Æ','AE ligature'],['Ç','C cedilla'],['È','E grave'],['É','E acute'],['Ê','E circumflex'],['Ë','E umlaut diaeresis'],['Ì','I grave'],['Í','I acute'],['Î','I circumflex'],['Ï','I umlaut diaeresis'],['Ð','Eth'],['Ñ','N tilde spanish enye'],['Ò','O grave'],['Ó','O acute'],['Ô','O circumflex'],['Õ','O tilde'],['Ö','O umlaut diaeresis'],['Ø','O stroke slash'],['Ù','U grave'],['Ú','U acute'],['Û','U circumflex'],['Ü','U umlaut diaeresis'],['Ý','Y acute'],['Þ','Thorn'],['ß','sharp s eszett german'],['à','a grave'],['á','a acute'],['â','a circumflex'],['ã','a tilde'],['ä','a umlaut diaeresis'],['å','a ring above'],['æ','ae ligature'],['ç','c cedilla'],['è','e grave'],['é','e acute'],['ê','e circumflex'],['ë','e umlaut diaeresis'],['ì','i grave'],['í','i acute'],['î','i circumflex'],['ï','i umlaut diaeresis'],['ð','eth'],['ñ','n tilde spanish enye'],['ò','o grave'],['ó','o acute'],['ô','o circumflex'],['õ','o tilde'],['ö','o umlaut diaeresis'],['ø','o stroke slash'],['ù','u grave'],['ú','u acute'],['û','u circumflex'],['ü','u umlaut diaeresis'],['ý','y acute'],['þ','thorn'],['ÿ','y diaeresis'],
        ]},
        { cat: 'Greek', items: [
            ['Α','Alpha uppercase'],['Β','Beta uppercase'],['Γ','Gamma uppercase'],['Δ','Delta uppercase'],['Ε','Epsilon uppercase'],['Ζ','Zeta uppercase'],['Η','Eta uppercase'],['Θ','Theta uppercase'],['Ι','Iota uppercase'],['Κ','Kappa uppercase'],['Λ','Lambda uppercase'],['Μ','Mu uppercase'],['Ν','Nu uppercase'],['Ξ','Xi uppercase'],['Ο','Omicron uppercase'],['Π','Pi uppercase'],['Ρ','Rho uppercase'],['Σ','Sigma uppercase'],['Τ','Tau uppercase'],['Υ','Upsilon uppercase'],['Φ','Phi uppercase'],['Χ','Chi uppercase'],['Ψ','Psi uppercase'],['Ω','Omega uppercase'],['α','alpha lowercase'],['β','beta lowercase'],['γ','gamma lowercase'],['δ','delta lowercase'],['ε','epsilon lowercase'],['ζ','zeta lowercase'],['η','eta lowercase'],['θ','theta lowercase'],['ι','iota lowercase'],['κ','kappa lowercase'],['λ','lambda lowercase'],['μ','mu micro lowercase'],['ν','nu lowercase'],['ξ','xi lowercase'],['ο','omicron lowercase'],['π','pi lowercase'],['ρ','rho lowercase'],['σ','sigma lowercase'],['τ','tau lowercase'],['υ','upsilon lowercase'],['φ','phi lowercase'],['χ','chi lowercase'],['ψ','psi lowercase'],['ω','omega lowercase'],
        ]},
        { cat: 'Misc Symbols', items: [
            ['©','copyright sign'],['®','registered trademark'],['™','trademark sign'],['℠','service mark'],['℗','sound recording copyright'],['℃','degree celsius'],['℉','degree fahrenheit'],['Ω','ohm sign'],['℧','inverted ohm mho'],['Å','angstrom sign'],['№','numero sign'],['℮','estimated sign'],['℞','prescription take'],['☐','ballot box unchecked'],['☑','ballot box check'],['☒','ballot box x'],['✓','check mark tick'],['✗','ballot x cross'],['✘','heavy ballot x'],['★','black star'],['☆','white star'],['♠','spade suit'],['♣','club suit'],['♥','heart suit'],['♦','diamond suit'],['♩','quarter note music'],['♪','eighth note music'],['♫','beamed eighth notes music'],['♬','beamed sixteenth notes'],['♭','music flat sign'],['♮','music natural sign'],['♯','music sharp sign'],['⌘','command key mac'],['⌥','option key mac alt'],['⇧','shift key'],['⌃','control key ctrl'],['⎋','escape key esc'],['⌫','delete key backspace'],['⏎','return enter key'],['⇥','tab key'],['␣','space symbol'],['⌧','clear key'],
        ]},
        { cat: 'Box Drawing', items: [
            ['─','box light horizontal'],['│','box light vertical'],['┌','box light down right'],['┐','box light down left'],['└','box light up right'],['┘','box light up left'],['├','box light vertical right'],['┤','box light vertical left'],['┬','box light down horizontal'],['┴','box light up horizontal'],['┼','box light vertical horizontal cross'],['═','box double horizontal'],['║','box double vertical'],['╔','box double down right'],['╗','box double down left'],['╚','box double up right'],['╝','box double up left'],['╠','box double vertical right'],['╣','box double vertical left'],['╦','box double down horizontal'],['╩','box double up horizontal'],['╬','box double vertical horizontal cross'],['░','light shade'],['▒','medium shade'],['▓','dark shade'],['█','full block'],['▄','lower half block'],['▀','upper half block'],['▌','left half block'],['▐','right half block'],['■','black square'],['□','white square'],['▪','black small square'],['▫','white small square'],['●','black circle'],['○','white circle'],['◆','black diamond'],['◇','white diamond'],['◈','white diamond containing black small diamond'],
        ]},
        { cat: 'Superscript & Subscript', items: [
            ['⁰','superscript zero'],['¹','superscript one'],['²','superscript two squared'],['³','superscript three cubed'],['⁴','superscript four'],['⁵','superscript five'],['⁶','superscript six'],['⁷','superscript seven'],['⁸','superscript eight'],['⁹','superscript nine'],['⁺','superscript plus'],['⁻','superscript minus'],['⁼','superscript equals'],['⁽','superscript left parenthesis'],['⁾','superscript right parenthesis'],['ⁿ','superscript n'],['₀','subscript zero'],['₁','subscript one'],['₂','subscript two'],['₃','subscript three'],['₄','subscript four'],['₅','subscript five'],['₆','subscript six'],['₇','subscript seven'],['₈','subscript eight'],['₉','subscript nine'],['₊','subscript plus'],['₋','subscript minus'],['₌','subscript equals'],['₍','subscript left parenthesis'],['₎','subscript right parenthesis'],
        ]},
    ];

    // ── State ──
    var activeTab = 'emoji'; // emoji | charmap | all
    var activeCategory = 'all';
    var searchQuery = '';
    var selected = null;
    var RECENT_KEY = 'devhelper_charmap_recent';
    var MAX_RECENT = 30;

    // DOM refs
    var searchInput = document.getElementById('searchInput');
    var categoriesBar = document.getElementById('categoriesBar');
    var charGrid = document.getElementById('charGrid');
    var detailPanel = document.getElementById('detailPanel');
    var charCount = document.getElementById('charCount');
    var recentSection = document.getElementById('recentSection');
    var recentGrid = document.getElementById('recentGrid');
    var copyToast = document.getElementById('copyToast');

    // ── Get data based on tab ──
    function getData() {
        if (activeTab === 'emoji') return EMOJI;
        if (activeTab === 'charmap') return CHARMAP;
        return EMOJI.concat(CHARMAP);
    }

    // ── Render categories ──
    function renderCategories() {
        var data = getData();
        var html = '<button class="cat-btn' + (activeCategory === 'all' ? ' active' : '') + '" data-cat="all">All</button>';
        data.forEach(function (group) {
            html += '<button class="cat-btn' + (activeCategory === group.cat ? ' active' : '') + '" data-cat="' + group.cat + '">' + group.cat + '</button>';
        });
        categoriesBar.innerHTML = html;
        categoriesBar.querySelectorAll('.cat-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeCategory = btn.dataset.cat;
                renderCategories();
                renderGrid();
            });
        });
    }

    // ── Render grid ──
    function renderGrid() {
        var data = getData();
        var q = searchQuery.toLowerCase();
        var html = '';
        var total = 0;

        data.forEach(function (group) {
            if (activeCategory !== 'all' && group.cat !== activeCategory) return;
            var items = group.items;
            if (q) {
                items = items.filter(function (item) {
                    return item[1].toLowerCase().includes(q) || item[0].includes(q);
                });
            }
            if (items.length === 0) return;

            if (activeCategory === 'all' && !q) {
                html += '<div class="section-label">' + group.cat + '</div>';
            }
            items.forEach(function (item) {
                var isSmall = item[0].length === 1 && item[0].charCodeAt(0) < 0x2600;
                html += '<div class="char-tile' + (isSmall ? ' small-char' : '') + '" data-char="' + escapeAttr(item[0]) + '" data-name="' + escapeAttr(item[1]) + '" title="' + escapeAttr(item[1]) + '">' + item[0] + '</div>';
                total++;
            });
        });

        if (total === 0) {
            html = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--bs-secondary-color);"><i class="bi bi-search" style="font-size:2rem;"></i><p class="mt-2">No characters found for "' + escapeHtml(searchQuery) + '"</p></div>';
        }

        charGrid.innerHTML = html;
        charCount.textContent = total + ' characters';

        charGrid.querySelectorAll('.char-tile').forEach(function (tile) {
            tile.addEventListener('click', function () {
                var ch = tile.dataset.char;
                var name = tile.dataset.name;
                copyChar(ch, name);
                showDetail(ch, name);
                // Highlight
                charGrid.querySelectorAll('.char-tile').forEach(function (t) { t.classList.remove('active'); });
                tile.classList.add('active');
            });
        });
    }

    // ── Copy character ──
    function copyChar(ch, name) {
        navigator.clipboard.writeText(ch).then(function () {
            showCopyToast(ch);
            addRecent(ch, name);
        });
    }

    function showCopyToast(ch) {
        copyToast.textContent = 'Copied: ' + ch;
        copyToast.classList.add('show');
        setTimeout(function () { copyToast.classList.remove('show'); }, 1200);
    }

    // ── Detail panel ──
    function showDetail(ch, name) {
        selected = { char: ch, name: name };
        var codePoint = '';
        var htmlEntity = '';
        var cssCode = '';
        var utf8 = '';

        // Get code points
        var codePoints = [];
        for (var i = 0; i < ch.length; i++) {
            var code = ch.codePointAt(i);
            codePoints.push('U+' + code.toString(16).toUpperCase().padStart(4, '0'));
            if (code > 0xFFFF) i++; // skip surrogate pair
        }
        codePoint = codePoints.join(' ');

        // HTML entity
        var entities = [];
        for (var i = 0; i < ch.length; i++) {
            var code = ch.codePointAt(i);
            entities.push('&#' + code + ';');
            if (code > 0xFFFF) i++;
        }
        htmlEntity = entities.join('');

        // CSS content
        var cssEntities = [];
        for (var i = 0; i < ch.length; i++) {
            var code = ch.codePointAt(i);
            cssEntities.push('\\' + code.toString(16).toUpperCase());
            if (code > 0xFFFF) i++;
        }
        cssCode = cssEntities.join('');

        // UTF-8 hex bytes
        var encoder = new TextEncoder();
        var bytes = encoder.encode(ch);
        utf8 = Array.from(bytes).map(function (b) { return b.toString(16).toUpperCase().padStart(2, '0'); }).join(' ');

        detailPanel.innerHTML = ''
            + '<div class="detail-char">' + ch + '</div>'
            + '<div class="detail-name">' + escapeHtml(name) + '</div>'
            + '<div class="detail-row"><span class="detail-label">Character</span><span class="detail-value" data-copy="' + escapeAttr(ch) + '">' + escapeHtml(ch) + '</span></div>'
            + '<div class="detail-row"><span class="detail-label">Unicode</span><span class="detail-value" data-copy="' + escapeAttr(codePoint) + '">' + codePoint + '</span></div>'
            + '<div class="detail-row"><span class="detail-label">HTML</span><span class="detail-value" data-copy="' + escapeAttr(htmlEntity) + '">' + escapeHtml(htmlEntity) + '</span></div>'
            + '<div class="detail-row"><span class="detail-label">CSS</span><span class="detail-value" data-copy="' + escapeAttr(cssCode) + '">' + cssCode + '</span></div>'
            + '<div class="detail-row"><span class="detail-label">UTF-8</span><span class="detail-value" data-copy="' + escapeAttr(utf8) + '">' + utf8 + '</span></div>'
            + '<button class="btn btn-primary btn-sm w-100 mt-3" id="detailCopyBtn"><i class="bi bi-clipboard"></i> Copy Character</button>';

        // Click to copy each detail value
        detailPanel.querySelectorAll('.detail-value').forEach(function (el) {
            el.addEventListener('click', function () {
                navigator.clipboard.writeText(el.dataset.copy).then(function () {
                    showCopyToast(el.dataset.copy);
                });
            });
        });

        document.getElementById('detailCopyBtn').addEventListener('click', function () {
            copyChar(ch, name);
        });
    }

    // ── Recent ──
    function getRecent() {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
        catch (e) { return []; }
    }

    function addRecent(ch, name) {
        var recent = getRecent().filter(function (r) { return r[0] !== ch; });
        recent.unshift([ch, name]);
        if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
        renderRecent();
    }

    function renderRecent() {
        var recent = getRecent();
        if (recent.length === 0) {
            recentSection.classList.add('d-none');
            return;
        }
        recentSection.classList.remove('d-none');
        recentGrid.innerHTML = recent.map(function (r) {
            return '<div class="recent-tile" data-char="' + escapeAttr(r[0]) + '" data-name="' + escapeAttr(r[1]) + '" title="' + escapeAttr(r[1]) + '">' + r[0] + '</div>';
        }).join('');
        recentGrid.querySelectorAll('.recent-tile').forEach(function (tile) {
            tile.addEventListener('click', function () {
                copyChar(tile.dataset.char, tile.dataset.name);
                showDetail(tile.dataset.char, tile.dataset.name);
            });
        });
    }

    // ── Tab switch ──
    document.querySelectorAll('[data-tab]').forEach(function (tab) {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('[data-tab]').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            activeCategory = 'all';
            renderCategories();
            renderGrid();
        });
    });

    // ── Search ──
    var searchDebounce;
    searchInput.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function () {
            searchQuery = searchInput.value;
            renderGrid();
        }, 150);
    });

    // ── Helpers ──
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Init ──
    renderCategories();
    renderGrid();
    renderRecent();
});

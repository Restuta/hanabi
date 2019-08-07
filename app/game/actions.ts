import IGameState, {
  IAction,
  IHand,
  ICard,
  ICardHint,
  IHintAction,
  IGameOptions,
  INumber,
  IColor,
  IPlayer
} from "./state";
import { cloneDeep, isEqual, findIndex, flatMap, range } from "lodash";
import assert from "assert";
import { shuffle } from "shuffle-seed";

export function commitAction(state: IGameState, action: IAction): IGameState {
  // the function should be pure
  const s = cloneDeep(state) as IGameState;

  assert(action.from === state.currentPlayer);
  const player = s.players[action.from];

  if (action.action === "discard" || action.action === "play") {
    // remove the card from hand and check that it's what we expect
    const [card] = player.hand.splice(action.cardIndex, 1);
    assert(isEqual(card, action.card));

    /** PLAY */
    if (action.action === "play") {
      if (isPlayable(card, s.playedCards)) {
        s.playedCards.push(action.card);
        if (card.number === 5) {
          // play a 5, win a hint
          s.tokens.hints += 1;
        }
      } else {
        // strike !
        s.tokens.strikes -= 1;
        s.discardPile.push(action.card);
      }
    } else {
      /** DISCARD */
      s.discardPile.push(action.card);
    }

    // in both cases (play, discard) we need to remove a card from the hand and get a new one
    const newCard = s.drawPile.pop();
    if (newCard) {
      player.hand.unshift(newCard);
    }
  }

  /** HINT */
  if (action.action === "hint") {
    assert(s.tokens.hints > 0);
    s.tokens.hints -= 1;

    assert(action.from !== action.to);
    const hand = s.players[action.to].hand;
    applyHint(hand, action);
  }

  // there's no card in the pile (or the last card was just drawn)
  // decrease the actionsLeft counter.
  // The game ends when it reaches 0.
  if (s.drawPile.length === 0) {
    s.actionsLeft -= 1;
  }

  // update player
  s.currentPlayer = (s.currentPlayer + 1) % s.options.playersCount;

  return s;
}

export function isGameOver(state: IGameState) {
  return (
    state.actionsLeft <= 0 ||
    state.tokens.strikes <= 0 ||
    state.playedCards.length === (state.options.multicolor ? 30 : 25)
  );
}

/**
 * Side effect function that applies the given hint on a given hand's cards
 */
function applyHint(hand: IHand, hint: IHintAction) {
  hand.forEach(card => {
    if (card[hint.type] === hint.value) {
      // positive hint, e.g. card is a red 5 and the hint is "color red"
      Object.keys(card.hint[hint.type]).forEach(value => {
        if (value === hint.value) {
          // it has to be this value
          card.hint[hint.type][value] = 2;
        } else {
          // all other values are impossible
          card.hint[hint.type][value] = 0;
        }
      });
    } else {
      // negative hint
      card.hint[hint.type][hint.value] = 0;
    }
  });
}

function isPlayable(card: ICard, playedCards: ICard[]): boolean {
  const isPreviousHere =
    card.number === 1 || // first card on the pile
    findIndex(
      playedCards,
      c => card.number === c.number + 1 && card.color === c.color
    ) > -1; // previous card belongs to the playedCards

  const isSameNotHere = findIndex(playedCards, c => isEqual(c, card)) === -1;

  return isPreviousHere && isSameNotHere;
}

export function emptyHint(options: IGameOptions): ICardHint {
  return {
    color: {
      blue: 1,
      red: 1,
      green: 1,
      white: 1,
      yellow: 1,
      multicolor: options.multicolor ? 1 : 0
    },
    number: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }
  };
}

function emptyPlayer(id: number, name: string): IPlayer {
  return {
    hand: [],
    name,
    id
  };
}

const colors = [
  IColor.BLUE,
  IColor.RED,
  IColor.GREEN,
  IColor.WHITE,
  IColor.YELLOW,
  IColor.MULTICOLOR
];

const playerNames = ["Akiyo", "Miho", "Tomoa", "Futaba", "Kai"];

export function newGame(options: IGameOptions, seed?: number): IGameState {
  if (seed === undefined) seed = +new Date() * Math.random();

  const startingHandSize = { 2: 5, 3: 5, 4: 4, 5: 4 };

  assert(options.playersCount > 1 && options.playersCount < 6);

  const cards: ICard[] = flatMap(colors, color => [
    { number: 1, color },
    { number: 1, color },
    { number: 1, color },
    { number: 2, color },
    { number: 2, color },
    { number: 3, color },
    { number: 3, color },
    { number: 4, color },
    { number: 4, color },
    { number: 5, color }
  ]);

  // Add extensions cards when applicable
  if (this.extension) {
    cards.push(
      { number: 1, color: IColor.MULTICOLOR },
      { number: 2, color: IColor.MULTICOLOR },
      { number: 3, color: IColor.MULTICOLOR },
      { number: 4, color: IColor.MULTICOLOR },
      { number: 5, color: IColor.MULTICOLOR }
    );
  }

  const deck = shuffle(cards, seed);

  const players = range(options.playersCount).map(i =>
    emptyPlayer(i, playerNames[i])
  );

  players.forEach(player => {
    player.hand = this.deck.splice(0, startingHandSize[this.players.length]);
  });

  const currentPlayer = shuffle(range(options.playersCount), seed);

  return {
    playedCards: [],
    drawPile: deck,
    discardPile: [],
    players,
    tokens: {
      hints: 8,
      strikes: 3
    },
    currentPlayer,
    options,
    actionsLeft: options.playersCount + 1 // this will be decreased when the draw pile is empty
  };
}

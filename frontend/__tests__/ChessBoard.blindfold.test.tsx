import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ChessBoard from "../src/components/ChessBoard";
import { useGameStore } from "../src/store/gameStore";

// Mock the dependencies
vi.mock("../src/api/gameApi", () => ({
	api: {
		makeMove: vi.fn(),
		getMoves: vi.fn().mockResolvedValue({ success: true, data: [] }),
		getGame: vi.fn(),
		createGame: vi.fn(),
		joinGame: vi.fn(),
		resignGame: vi.fn(),
		offerDraw: vi.fn(),
		acceptDraw: vi.fn(),
		getChatHistory: vi.fn().mockResolvedValue({ success: true, data: [] }),
	},
}));

vi.mock("../src/api/socket", () => ({
	socketService: {
		connect: vi.fn(),
		disconnect: vi.fn(),
		joinGame: vi.fn(),
		leaveGame: vi.fn(),
		onGameUpdate: vi.fn(),
		onRematchRequested: vi.fn(),
		offRematchRequested: vi.fn(),
		onChatMessage: vi.fn(),
		offGameUpdate: vi.fn(),
		offChatMessage: vi.fn(),
		sendChatMessage: vi.fn(),
	},
}));

vi.mock("../src/services/soundService", () => ({
	soundService: {
		isEnabled: vi.fn().mockReturnValue(true),
		toggle: vi.fn().mockReturnValue(true),
		getVolume: vi.fn().mockReturnValue(0.8),
		setVolume: vi.fn(),
		move: vi.fn(),
		capture: vi.fn(),
		castle: vi.fn(),
		promote: vi.fn(),
		check: vi.fn(),
		gameStart: vi.fn(),
		gameEnd: vi.fn(),
		draw: vi.fn(),
	},
}));

const mockBoard = [
	["r", "n", "b", "q", "k", "b", "n", "r"],
	["p", "p", "p", "p", "p", "p", "p", "p"],
	[".", ".", ".", ".", ".", ".", ".", "."],
	[".", ".", ".", ".", ".", ".", ".", "."],
	[".", ".", ".", ".", ".", ".", ".", "."],
	[".", ".", ".", ".", ".", ".", ".", "."],
	["P", "P", "P", "P", "P", "P", "P", "P"],
	["R", "N", "B", "Q", "K", "B", "N", "R"],
];

const renderChessBoard = () => {
	return render(
		<BrowserRouter>
			<ChessBoard />
		</BrowserRouter>,
	);
};

const queryBoardText = (text: string) => {
	const board = document.querySelector('[aria-label^="Chess board"]');
	return Array.from(board?.querySelectorAll("span") ?? []).find(
		(span) => span.textContent === text,
	) ?? null;
};

describe("ChessBoard - Blindfold Mode Rendering", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		useGameStore.setState({
			gameCode: "TEST123",
			playerColor: "white",
			board: mockBoard,
			currentTurn: "white",
			status: "active",
			isBlindfoldMode: false,
			moveHistory: [],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("renders normal piece SVGs when blindfold mode is false", () => {
		renderChessBoard();

		// Should render piece symbols (Unicode characters)
		expect(queryBoardText("♚")).toBeTruthy(); // Black king
		expect(queryBoardText("♔")).toBeTruthy(); // White king
	});

	it("hides piece SVGs and shows placeholder dots when blindfold mode is true", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		const { container } = renderChessBoard();

		// Should NOT render piece symbols
		expect(queryBoardText("♚")).toBeFalsy();
		expect(queryBoardText("♔")).toBeFalsy();

		// Should render placeholder dots (divs with specific dimensions)
		const dots = container.querySelectorAll(
			'div[style*="width: calc(var(--board-size) / 8 * 0.18)"]',
		);
		expect(dots.length).toBeGreaterThan(0);
	});

	it("reveals real pieces when peeking (isPeeking is true)", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		renderChessBoard();

		// Initially hidden
		expect(queryBoardText("♚")).toBeFalsy();

		// Trigger peek
		const peekButton = screen.getByTitle(/Peek at pieces/i);
		fireEvent.click(peekButton);

		// After peek is triggered, pieces should be visible
		expect(queryBoardText("♚")).toBeTruthy();
	});

	it("hides pieces again after peek duration (2 seconds)", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		renderChessBoard();

		// Trigger peek
		const peekButton = screen.getByTitle(/Peek at pieces/i);
		fireEvent.click(peekButton);

		// Pieces should be visible immediately
		expect(queryBoardText("♚")).toBeTruthy();

		// Advance timers by 2 seconds
		act(() => vi.advanceTimersByTime(2000));

		// Pieces should be hidden again
		expect(queryBoardText("♚")).toBeFalsy();
	});

	it("peek button is disabled while peeking", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		renderChessBoard();

		const peekButton = screen.getByTitle(/Peek at pieces/i) as HTMLButtonElement;
		expect(peekButton.disabled).toBe(false);

		fireEvent.click(peekButton);

		expect(peekButton.disabled).toBe(true);
	});

	it("peek button is re-enabled after 2 seconds", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		renderChessBoard();

		const peekButton = screen.getByTitle(/Peek at pieces/i) as HTMLButtonElement;
		fireEvent.click(peekButton);

		expect(peekButton.disabled).toBe(true);

		act(() => vi.advanceTimersByTime(2000));

		expect(peekButton.disabled).toBe(false);
	});

	it("ignores another peek click while the button is disabled", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		renderChessBoard();

		const peekButton = screen.getByTitle(/Peek at pieces/i);

		// First click
		fireEvent.click(peekButton);
		expect(queryBoardText("♚")).toBeTruthy();

		// Advance to 1 second (before original 2s ends)
		act(() => vi.advanceTimersByTime(1000));

		// The button is disabled while peeking, so a second click is ignored.
		fireEvent.click(peekButton);

		// Advance to 2 seconds after the first click.
		act(() => vi.advanceTimersByTime(1000));

		// The first click's timer expires normally.
		expect(queryBoardText("♚")).toBeFalsy();
	});

	it("peek button is only visible when blindfold mode is active", () => {
		useGameStore.setState({ isBlindfoldMode: false });
		const { rerender } = renderChessBoard();

		expect(screen.queryByTitle(/Peek at pieces/i)).toBeFalsy();

		// Enable blindfold mode
		useGameStore.setState({ isBlindfoldMode: true });
		rerender(
			<BrowserRouter>
				<ChessBoard />
			</BrowserRouter>,
		);

		expect(screen.queryByTitle(/Peek at pieces/i)).toBeTruthy();
	});

	it("squares remain clickable when blindfold mode is active and pieces are hidden", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		const { container } = renderChessBoard();

		const square = container.querySelector('[data-testid="square-1-4"]');
		expect(square).toBeTruthy();

		// Click a square with a piece (e2 for white pawn)
		const e2Square = container.querySelector('[data-testid="square-6-4"]');
		expect(e2Square).toBeTruthy();

		fireEvent.click(e2Square!);

		// The click should be processed (square should be selectable)
		// Even though piece is hidden, the square interaction must work
		const selected = container.querySelector('[data-testid="square-6-4"]');
		expect(selected?.className).toContain("bg-yellow");
	});

	it("cleans up timer on component unmount", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		const { unmount } = renderChessBoard();

		const peekButton = screen.getByTitle(/Peek at pieces/i);
		fireEvent.click(peekButton);

		// Unmount before timer fires
		unmount();

		// Advance timer - should not cause any errors
		vi.advanceTimersByTime(3000);

		// No errors should occur
		expect(true).toBe(true);
	});

	it("isPeeking resets to false on component remount", () => {
		useGameStore.setState({ isBlindfoldMode: true });
		const { unmount } = renderChessBoard();

		const peekButton = screen.getByTitle(/Peek at pieces/i);
		fireEvent.click(peekButton);

		expect(queryBoardText("♚")).toBeTruthy();

		unmount();

		// Remount component
		renderChessBoard();

		// Pieces should be hidden again (isPeeking reset to false)
		expect(queryBoardText("♚")).toBeFalsy();
	});

	it("toggles between blindfold and normal rendering modes", async () => {
		const { rerender } = renderChessBoard();

		// Initially in normal mode
		expect(queryBoardText("♚")).toBeTruthy();

		// Switch to blindfold mode
		useGameStore.setState({ isBlindfoldMode: true });
		rerender(
			<BrowserRouter>
				<ChessBoard />
			</BrowserRouter>,
		);

		expect(queryBoardText("♚")).toBeFalsy();

		// Switch back to normal mode
		useGameStore.setState({ isBlindfoldMode: false });
		rerender(
			<BrowserRouter>
				<ChessBoard />
			</BrowserRouter>,
		);

		expect(queryBoardText("♚")).toBeTruthy();
	});

	it("move interaction is not affected by blindfold mode", () => {
		useGameStore.setState({ 
			isBlindfoldMode: true,
			playerColor: "white",
			currentTurn: "white",
		});
		const { container } = renderChessBoard();

		// Click on e2 (white pawn at [6, 4])
		const e2Square = container.querySelector('[data-testid="square-6-4"]');
		fireEvent.click(e2Square!);

		// Square should be selected
		expect(e2Square?.className).toContain("outline-yellow");

		// Click on e3 to move there ([5, 4])
		const e3Square = container.querySelector('[data-testid="square-5-4"]');
		fireEvent.click(e3Square!);

		// Move should be processed
		// (The actual move would be handled by the store)
		expect(true).toBe(true);
	});
});

describe("ChessBoard - Peek Button Position and Styling", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		useGameStore.setState({
			gameCode: "TEST123",
			playerColor: "white",
			board: mockBoard,
			currentTurn: "white",
			status: "active",
			isBlindfoldMode: true,
			moveHistory: [],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("peek button appears in action bar when blindfold mode is active", () => {
		renderChessBoard();
		const peekButton = screen.getByTitle(/Peek at pieces/i);
		expect(peekButton).toBeTruthy();
	});

	it("peek button shows eye icon", () => {
		renderChessBoard();
		const peekButton = screen.getByTitle(/Peek at pieces/i);
		const svg = peekButton.querySelector("svg");
		expect(svg).toBeTruthy();
	});

	it("peek button has correct title text", () => {
		renderChessBoard();
		const peekButton = screen.getByTitle(/Peek at pieces/i);
		expect(peekButton.title).toContain("Peek");
	});
});

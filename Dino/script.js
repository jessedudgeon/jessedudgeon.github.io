const dino = document.getElementById("dino");
const cactus = document.getElementById("cactus");
const gameOverText = document.getElementById("gameOver");
const scoreText = document.getElementById("score");

let isJumping = false;
let isGameOver = false;
let score = 0;
let speed = 10;
let cactusPosition = window.innerWidth;

function jump() {
  if (isJumping || isGameOver) return;
  isJumping = true;

  let position = 0;
  const upInterval = setInterval(() => {
    if (position >= 120) {
      clearInterval(upInterval);
      const downInterval = setInterval(() => {
        if (position <= 0) {
          clearInterval(downInterval);
          isJumping = false;
        } else {
          position -= 5;
          dino.style.bottom = position + "px";
        }
      }, 20);
    } else {
      position += 5;
      dino.style.bottom = position + "px";
    }
  }, 20);
}

function startGame() {
  cactus.style.left = "100%";
  gameOverText.style.display = "none";
  isGameOver = false;
  score = 0;
  speed = 10;
  cactusPosition = window.innerWidth;

  dino.style.bottom = "0px";

  const gameLoop = setInterval(() => {
    if (isGameOver) {
      clearInterval(gameLoop);
      return;
    }

    // Move cactus
    cactusPosition -= speed;
    cactus.style.left = cactusPosition + "px";

    // Collision check
    const dinoTop = parseInt(window.getComputedStyle(dino).bottom);
    const cactusLeft = cactus.getBoundingClientRect().left;

    if (
      cactusLeft < 90 &&
      cactusLeft > 50 &&
      dinoTop < 45
    ) {
      isGameOver = true;
      gameOverText.style.display = "block";
      return;
    }

    // Reset cactus
    if (cactusPosition < -50) {
      cactusPosition = window.innerWidth + Math.random() * 300;
      score += 100;
      scoreText.textContent = "Score: " + score;

      // Ramp up speed every 500 points
      if (score % 500 === 0) {
        speed += 2;
      }
    }

  }, 30);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (isGameOver) {
      startGame();
    } else {
      jump();
    }
  }
});

startGame();

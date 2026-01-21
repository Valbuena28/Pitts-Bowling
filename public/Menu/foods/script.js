const foods = JSON.parse(localStorage.getItem("foods")) || [];
const index = localStorage.getItem("detalleIndex");
const food = foods[index];

if(food) {
  document.getElementById("foodDetail").innerHTML = `
    <h1>${food.title}</h1>
    <img src="${food.image}" alt="${food.title}">
    <p>${food.description}</p>
  `;
}

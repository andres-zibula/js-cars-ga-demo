////////////////////////////////////////////////////////////////////////////////
/////// Author: Andres Zibula                                           ////////
/////// Source: https://github.com/andres-zibula/js-cars-ga-demo        ////////
////////////////////////////////////////////////////////////////////////////////

var canvas = document.getElementById("idCanvas");
var ctx = canvas.getContext("2d");
var jumpGenerations = false;

var cellSize = 25;
var cells_x = 20,
    cells_y = 20;
var world;
var roads, numberOfRoads = 4;
var north = 0,
    east = 1,
    south = 2,
    west = 3;
var grassCell = 0,
    roadCell = 1,
    roadCellGoodWay = 2,
    roadCellBadWay = 3,
    carCell = 4,
    wallCell = 5;
var maxPopulation = 24;
var mutationProbability = 0.001;
var speed = 1000;
var population;
var carStates = 8,
    carPerceptions = 6,
    carActions = 3;

//car actions
var forward = 0,
    turnLeft = 1,
    turnRight = 2;

var iterationsPerGeneration = 512,
    currentIteration = 0;

function Road(minX, minY, maxX, maxY, direction) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.direction = direction;
}

function Car(x, y, color) {
    this.x = x;
    this.y = y;
    this.direction = Math.floor(4 * Math.random());
    this.color = color;
    this.fitness = 0;
    this.state = Math.floor(carStates * Math.random());

    this.gene = new Array(carStates);
    for (var i = 0; i < carStates; i++) {
        this.gene[i] = new Array(carPerceptions);
        for (var j = 0; j < carPerceptions; j++) {
            this.gene[i][j] = {
                nextState: null,
                nextAction: null
            };
        }
    }

    this.generate = function() {
        for (var i = 0; i < carStates; i++) {

            for (var j = 0; j < carPerceptions; j++) {
                this.gene[i][j] = {
                    nextState: Math.floor(carStates * Math.random()),
                    nextAction: Math.floor(carActions * Math.random())
                };
            }
        }
    }

    this.mutate = function() {
        for (var i = 0; i < carStates; i++) {

            for (var j = 0; j < carPerceptions; j++) {
                if (Math.random() < mutationProbability) {
                    this.gene[i][j].nextState = Math.floor(carStates * Math.random());
                }
                if (Math.random() < mutationProbability) {
                    this.gene[i][j].nextAction = Math.floor(carActions * Math.random());
                }
            }
        }
    }
    this.cross = function(car) {
        var newCar = new Car(0, 0, "red");

        var crossPoint = Math.floor(Math.random() * carStates * carPerceptions);

        var counter = 0;
        for (var i = 0; i < carStates; i++) {
            for (var j = 0; j < carPerceptions; j++) {
                if (counter > crossPoint) {
                    newCar.gene[i][j].nextState = this.gene[i][j].nextState;
                } else {
                    newCar.gene[i][j].nextState = car.gene[i][j].nextState;
                }
                counter++;
                if (counter > crossPoint) {
                    newCar.gene[i][j].nextAction = this.gene[i][j].nextAction;
                } else {
                    newCar.gene[i][j].nextAction = car.gene[i][j].nextAction;
                }
                counter++;
            }
        }

        return newCar;
    };

    this.goForward = function() {
        world[this.x][this.y].isEmpty = true;

        switch (this.direction) {
            case north:
                this.y = this.y - 1;
                world[this.x][this.y].isEmpty = false;
                break;
            case east:
                this.x = this.x + 1;
                world[this.x][this.y].isEmpty = false;
                break;
            case south:
                this.y = this.y + 1;
                world[this.x][this.y].isEmpty = false;
                break;
            case west:
                this.x = this.x - 1;
                world[this.x][this.y].isEmpty = false;
                break;
        }
    };
    this.cellInFront = function() {
        var frontCell = null;

        switch (this.direction) {
            case north:
                frontCell = clone(world[this.x][this.y - 1]);
                break;
            case east:
                frontCell = clone(world[this.x + 1][this.y]);
                break;
            case south:
                frontCell = clone(world[this.x][this.y + 1]);
                break;
            case west:
                frontCell = clone(world[this.x - 1][this.y]);
                break;
        }

        if ((!frontCell.isEmpty) && (frontCell.cellType != wallCell)) {
            frontCell.cellType = carCell;
        } else if (frontCell.cellType == roadCell) {

            var roadsArray = roadsOfCell(frontCell);

            for (var i = 0; i < roadsArray.length; i++) {

                if (frontCell.cellType != roadCellGoodWay) {
                    if (this.direction == roadsArray[i].direction) {
                        frontCell.cellType = roadCellGoodWay;
                    } else if (this.direction == opositeDirection(roadsArray[i].direction)) {
                        frontCell.cellType = roadCellBadWay;
                    }
                }
            }
        }

        return frontCell.cellType;
    };
}

function Population(popSize) {
    this.popSize = popSize;
    this.generation = 0;
    this.cars = new Array(popSize);
    for (var i = 0; i < this.popSize; i++) {
        this.cars[i] = new Car(0, 0, "red");
        this.cars[i].generate();
    }

    this.clearPositions = function() {
        for (var i = 0; i < this.popSize; i++) {
            world[this.cars[i].x][this.cars[i].y].isEmpty = true;
        }
    };
    this.place = function() {
        for (var i = 0; i < this.popSize; i++) {

            var x = Math.floor(cells_x * Math.random());
            var y = Math.floor(cells_y * Math.random());
            while (!world[x][y].isEmpty) {
                var x = Math.floor(cells_x * Math.random());
                var y = Math.floor(cells_y * Math.random());
            }

            this.cars[i].x = x;
            this.cars[i].y = y;
            world[x][y].isEmpty = false;
        }
    };
    this.relocate = function() {
        this.clearPositions();
        this.place();
    };

    this.selectByTournament = function() {
        var tournamentSize = 2;

        var num = Math.floor(this.popSize * Math.random());
        var fittest = this.cars[num];

        for (var i = 0; i < tournamentSize; i++) {
            var num = Math.floor(this.popSize * Math.random());
            if (this.cars[num].fitness > fittest.fitness) {
                fittest = this.cars[num];
            }
        }

        return fittest;
    };

    this.evolve = function() {
        var newCars = new Array(popSize);

        for (var i = 0; i < this.popSize; i++) {
            var car1 = this.selectByTournament();
            var car2 = this.selectByTournament();

            newCars[i] = car1.cross(car2);
            newCars[i].mutate();
        }

        this.cars = newCars;
        this.generation++;
    };

    this.calculateAverageFitness = function() {
        var averageFitness = 0;
        //var text = "";
        for (var i = 0; i < this.popSize; i++) {
            averageFitness += this.cars[i].fitness;
            //text += this.cars[i].fitness + ", ";
        }
        //text += "avg: " + averageFitness + "; pop: " + this.popSize;

        //console.log(text);
        return averageFitness / this.popSize;
    };
}

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

function roadsOfCell(cell) {
    var roadsArray = new Array();
    for (var i = 0; i < numberOfRoads; i++) {


        if ((cell.x >= roads[i].minX) && (cell.y >= roads[i].minY)) {
            if ((cell.x <= roads[i].maxX) && (cell.y <= roads[i].maxY)) {
                roadsArray.push(roads[i]);
            }
        }

        return roadsArray;
    }
}

function opositeDirection(dir) {
    switch (dir) {
        case north:
            return south;
            break;
        case east:
            return west;
            break;
        case south:
            return north;
            break;
        case west:
            return east;
            break;
    }
}

function drawCells() {
    for (var i = 0; i < cells_x; i++) {

        for (var j = 0; j < cells_y; j++) {

            switch (world[i][j].cellType) {
                case grassCell:
                    drawCell(i, j, "green");
                    break;
                case wallCell:
                    drawCell(i, j, "black");
                    break;
                case roadCell:
                    drawCell(i, j, "grey");
                    break;
            }
        }
    }
}

function drawArrows() {

    var arrowColor = "yellow";

    for (var i = 0; i < numberOfRoads; i++) {

        switch (roads[i].direction) {
            case north:
                var x = roads[i].maxX - 2.5;
                var y = Math.floor((roads[i].maxY - roads[i].minY) / 2) + roads[i].minY;
                drawCell(x, y - 1, arrowColor);
                drawCell(x, y, arrowColor);
                drawCell(x, y + 1, arrowColor);

                ctx.beginPath();
                ctx.moveTo(x * cellSize + cellSize / 2, y * cellSize - 2 * cellSize);
                ctx.lineTo(x * cellSize + 1 * cellSize + cellSize / 2, y * cellSize - 1 * cellSize);
                ctx.lineTo(x * cellSize - cellSize / 2, y * cellSize - 1 * cellSize);
                ctx.fillStyle = arrowColor;
                ctx.fill();
                break;
            case south:
                var x = roads[i].maxX - 2.5;
                var y = Math.floor((roads[i].maxY - roads[i].minY) / 2) + roads[i].minY;
                drawCell(x, y - 2, arrowColor);
                drawCell(x, y - 1, arrowColor);
                drawCell(x, y, arrowColor);

                ctx.beginPath();
                ctx.moveTo(x * cellSize + cellSize / 2, y * cellSize + 2 * cellSize);
                ctx.lineTo(x * cellSize + 1 * cellSize + cellSize / 2, y * cellSize + 1 * cellSize);
                ctx.lineTo(x * cellSize - cellSize / 2, y * cellSize + 1 * cellSize);
                ctx.fillStyle = arrowColor;
                ctx.fill();
                break;
            case east:
                var x = Math.floor((roads[i].maxX - roads[i].minX) / 2) + roads[i].minX;
                var y = roads[i].maxY - 2.5;
                drawCell(x - 2, y, arrowColor);
                drawCell(x - 1, y, arrowColor);
                drawCell(x, y, arrowColor);

                ctx.beginPath();
                ctx.moveTo(x * cellSize + 2 * cellSize, y * cellSize + cellSize / 2);
                ctx.lineTo(x * cellSize + 1 * cellSize, y * cellSize - 1 * cellSize / 2);
                ctx.lineTo(x * cellSize + 1 * cellSize, y * cellSize + 1 * cellSize + cellSize / 2);
                ctx.fillStyle = arrowColor;
                ctx.fill();
                break;
            case west:
                var x = Math.floor((roads[i].maxX - roads[i].minX) / 2) + roads[i].minX;
                var y = roads[i].maxY - 2.5;
                drawCell(x - 1, y, arrowColor);
                drawCell(x, y, arrowColor);
                drawCell(x + 1, y, arrowColor);

                ctx.beginPath();
                ctx.moveTo(x * cellSize - 2 * cellSize, y * cellSize + cellSize / 2);
                ctx.lineTo(x * cellSize - 1 * cellSize, y * cellSize - 1 * cellSize / 2);
                ctx.lineTo(x * cellSize - 1 * cellSize, y * cellSize + 1 * cellSize + cellSize / 2);
                ctx.fillStyle = arrowColor;
                ctx.fill();
                break;
        }
    }
}

function drawPopulation() {
    for (var i = 0; i < population.popSize; i++) {
        var x = population.cars[i].x;
        var y = population.cars[i].y;
        var direction = population.cars[i].direction;
        var color = population.cars[i].color;

        switch (direction) {
            case north:
                ctx.beginPath();
                ctx.moveTo(x * cellSize + cellSize / 2, y * cellSize);
                ctx.lineTo(x * cellSize + 1 * cellSize, y * cellSize + 1 * cellSize);
                ctx.lineTo(x * cellSize, y * cellSize + 1 * cellSize);
                ctx.fillStyle = color;
                ctx.fill();
                break;
            case east:
                ctx.beginPath();
                ctx.moveTo(x * cellSize + 1 * cellSize, y * cellSize + cellSize / 2);
                ctx.lineTo(x * cellSize, y * cellSize + 1 * cellSize);
                ctx.lineTo(x * cellSize, y * cellSize);
                ctx.fillStyle = color;
                ctx.fill();
                break;
            case south:
                ctx.beginPath();
                ctx.moveTo(x * cellSize + cellSize / 2, y * cellSize + 1 * cellSize);
                ctx.lineTo(x * cellSize, y * cellSize);
                ctx.lineTo(x * cellSize + 1 * cellSize, y * cellSize);
                ctx.fillStyle = color;
                ctx.fill();
                break;
            case west:
                ctx.beginPath();
                ctx.moveTo(x * cellSize, y * cellSize + cellSize / 2);
                ctx.lineTo(x * cellSize + 1 * cellSize, y * cellSize);
                ctx.lineTo(x * cellSize + 1 * cellSize, y * cellSize + 1 * cellSize);
                ctx.fillStyle = color;
                ctx.fill();
                break;
        }
    }
}

function drawInfo() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Generation: " + population.generation, 8, 20);
    ctx.fillText("Avg fitness: " + population.calculateAverageFitness(), canvas.width - 128, 20);
}

function drawCell(x, y, color) {
    ctx.beginPath();
    ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

function drawSmallCell(x, y, color) {
    ctx.beginPath();
    ctx.rect(x * cellSize + cellSize / 4, y * cellSize + cellSize / 4, cellSize / 2, cellSize / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

function markEmptyCells() {
    for (var i = 0; i < cells_x; i++) {

        for (var j = 0; j < cells_y; j++) {
            if (world[i][j].isEmpty) {
                drawSmallCell(i, j, "blue");
            }
        }
    }
}

function doLogic() {
    for (var i = 0; i < population.popSize; i++) {
        var car = population.cars[i];

        var currentState = car.state;
        var frontCell = car.cellInFront();
        var nextState = car.gene[currentState][frontCell].nextState;
        var nextAction = car.gene[currentState][frontCell].nextAction;

        car.state = nextState;


        switch (nextAction) {
            case forward:
                switch (frontCell) {
                    case grassCell:
                        car.goForward();
                        car.fitness += -1;
                        break;
                    case roadCell:
                        car.goForward();
                        car.fitness += 1;
                        break;
                    case roadCellGoodWay:
                        car.goForward();
                        car.fitness += 1;
                        break;
                    case roadCellBadWay:
                        car.goForward();
                        car.fitness += 1;
                        break;
                    case wallCell:
                        car.fitness += -1;
                        break;
                    case carCell:
                        car.fitness += -1;
                        break;
                    default:
                        break;
                }
                break;
            case turnLeft:
                car.fitness += -1;
                car.direction--;
                if (car.direction < 0) {
                    car.direction = 3;
                }
                break;
            case turnRight:
                car.fitness += -1;
                car.direction++;
                if (car.direction > 3) {
                    car.direction = 0;
                }
                break;
        }
    } //end for
}

function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCells();
    drawArrows();
    drawPopulation();
    drawInfo();
}

function initialize() {
    world = new Array(cells_x);
    for (var i = 0; i < cells_x; i++) {
        world[i] = new Array(cells_y);

        for (var j = 0; j < cells_y; j++) {
            world[i][j] = {
                cellType: grassCell,
                isEmpty: true,
                x: i,
                y: j
            };
        }
    }

    //roads
    roads = new Array(numberOfRoads);
    roads[0] = new Road(3, 3, 7, 17, north);
    roads[1] = new Road(3, 3, 17, 7, east);
    roads[2] = new Road(13, 3, 17, 17, south);
    roads[3] = new Road(3, 13, 17, 17, west);

    for (var i = 0; i < numberOfRoads; i++) {

        for (var x = roads[i].minX; x < roads[i].maxX; x++) {

            for (var y = roads[i].minY; y < roads[i].maxY; y++) {
                world[x][y].cellType = roadCell;
            }
        }
    }


    //walls
    for (var i = 0; i < cells_x; i++) {
        world[i][0].cellType = wallCell;
        world[i][0].isEmpty = false;
        world[i][cells_y - 1].cellType = wallCell;
        world[i][cells_y - 1].isEmpty = false;

    }
    for (var j = 0; j < cells_y; j++) {
        world[0][j].cellType = wallCell;
        world[0][j].isEmpty = false;
        world[cells_x - 1][j].cellType = wallCell;
        world[cells_x - 1][j].isEmpty = false;

    }

    population = new Population(maxPopulation);
    population.place();

}

document.addEventListener("DOMContentLoaded", function() {
    initialize();

    (function mainLoop() {
        drawCheckbox = document.getElementById("drawCheckbox");
        if (drawCheckbox.checked) {
            drawAll();
        }


        /*jumpGenerations = Number(document.getElementById("jumpGenerationsDropdown").value);*/
        if (jumpGenerations) {
            currentGen = clone(population.generation);
            jumpGenerations = false;

            while (currentGen + 50 > population.generation) {
                doLogic();
                currentIteration++;

                if (currentIteration >= iterationsPerGeneration) {
                    currentIteration = 0;
                    population.clearPositions();
                    population.evolve();
                    population.place();
                }
            }
        }



        runCheckbox = document.getElementById("runCheckbox");
        if (runCheckbox.checked) {
            doLogic();
            currentIteration++;

            if (currentIteration >= iterationsPerGeneration) {
                currentIteration = 0;
                population.clearPositions();
                population.evolve();
                population.place();
            }
        }




        speed = document.getElementById("speedDropdown").value;
        setTimeout(mainLoop, 1000 / speed)
    })();
});

function jumpFunction() {
    jumpGenerations = true;
}
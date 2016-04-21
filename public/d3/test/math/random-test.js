var vows = require("vows"),
    load = require("../load"),
    assert = require("../assert"),
    seedrandom = require("seedrandom");

var suite = vows.describe("d3.random");

var _random;

// Testing a random number generator is a bit more complicated than testing
// deterministic code, so we use different techniques.
//
// If the RNG is correct, each test in this suite will pass with probability
// at least P. The tests have been designed so that P ≥ 98%. Specific values
// of P are given above each case. We use the seedrandom module to get around
// this non-deterministic aspect -- so it is safe to assume that if the tests
// fail, then d3's RNG is broken.
//
// See also: http://www.johndcook.com/Beautiful_Testing_ch10.pdf

suite.addBatch({
  "random": {
    topic: load("math/random").sandbox({Math: Math}).expression("d3.random"),
    "(using seedrandom)": {
      topic: function(random) {
        _random = Math.random;
        Math.seedrandom("a random seed.");
        return random;
      },
      "normal": {
        "topic": function(random) { return random.normal(-43289, 38.8); },
        "has normal distribution": KSTest(normalCDF(-43289, 38.8))
      },
      "logNormal": {
        "topic": function(random) { return random.logNormal(10, 2.5); },
        "has log-normal distribution": KSTest(logNormalCDF(10, 2.5))
      },
      "irwinHall": {
        "topic": function(random) { return random.irwinHall(10); },
        "has Irwin-Hall distribution": KSTest(irwinHallCDF(10))
      },
      teardown: function() {
        Math.random = _random;
      }
    }
  }
});

/**
 * A macro that that takes a RNG and performs a Kolmogorov-Smirnov test:
 * asserts that the values generated by the RNG could be generated by the
 * distribution with cumulative distribution function `cdf'. Each test runs in
 * O(n log n) * O(cdf).
 *
 * Passes with P≈98%.
 *
 * @param cdf function(x) { returns CDF of the distribution evaluated at x }
 * @param n number of sample points. Higher n = better evaluation, slower test.
 * @return a function that asserts the rng produces values fitting the distribution
 */
function KSTest(cdf, n) {
  return function(rng) {
    var n = 1000;
    var values = [];
    for (var i = 0; i < n; i++) {
      values.push(rng());
    }
    values.sort(function(a, b) { return a - b; });

    K_positive = -Infinity;  // Identity of max() function
    for (var i = 0; i < n; i++) {
      var edf_i = i / n;  // Empirical distribution function evaluated at x=values[i]
      K_positive = Math.max(K_positive, edf_i - cdf(values[i]));
    }
    K_positive *= Math.sqrt(n);

    // Derivation of this interval is difficult.
    // @see K-S test in Knuth's AoCP vol.2
    assert.inDelta(K_positive, 0.723255, 0.794145);
  };
}

// Logistic approximation to normal CDF around N(mean, stddev).
function normalCDF(mean, stddev) {
  return function(x) {
    return 1 / (1 + Math.exp(-0.07056 * Math.pow((x-mean)/stddev, 3) - 1.5976 * (x-mean)/stddev));
  };
}

// See http://en.wikipedia.org/wiki/Log-normal_distribution#Similar_distributions
function logNormalCDF(mean, stddev) {
  var exponent = Math.PI / (stddev * Math.sqrt(3));
  var numerator = Math.exp(mean);
  return function(x) {
    return 1 / (Math.pow(numerator / x, exponent) + 1);
  };
}

function irwinHallCDF(n) {
  var normalisingFactor = factorial(n);

  // Precompute binom(n, k), k=0..n for efficiency. (this array gets stored
  // inside the closure, so it is only computed once)
  var binoms = [];
  for (var k = 0; k <= n; k++) {
    binoms.push(binom(n, k));
  }

  // See CDF at http://en.wikipedia.org/wiki/Irwin–Hall_distribution
  return function(x) {
    var t = 0;
    for (var k = 0; k < x; k++) {
      t += Math.pow(-1, k % 2) * binoms[k] * Math.pow(x - k, n);
    }
    return t / normalisingFactor;
  };
}

function factorial(n) {
  var t = 1;
  for (var i = 2; i <= n; i++) {
    t *= i;
  }
  return t;
}

function binom(n, k) {
  if (k < 0 || k > n) return undefined;  // only defined for 0 <= k <= n
  return factorial(n) / (factorial(k) * factorial(n - k));
}

suite.export(module);

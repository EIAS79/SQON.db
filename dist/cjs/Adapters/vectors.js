"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const recordPath_1 = require("../Functions/recordPath");
const axios_1 = __importDefault(require("axios"));
const loggers_1 = __importDefault(require("../Functions/loggers"));
const ml_matrix_1 = require("ml-matrix");
const tsne = require('tsne-js');
const umap = __importStar(require("umap-js"));
class nuv_vector {
    logger;
    indexes = null;
    constructor(indexes) {
        this.logger = new loggers_1.default();
        this.indexes = indexes;
    }
    embeddingCache = new Map();
    async fetchEmbedding(text) {
        try {
            if (this.embeddingCache.has(text)) {
                return this.embeddingCache.get(text);
            }
            const response = await axios_1.default.post(`https://api.electronhub.top/v1/embeddings`, {
                model: "text-embedding-3-large",
                input: text,
            }, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ek-am4V5cXBlrCvRx7Ts3TXmvki5CTP3HZst4bNAbyH0XSkzmOqG1`,
                },
            });
            const embedding = response.data.data[0].embedding;
            this.embeddingCache.set(text, embedding);
            return embedding;
        }
        catch (error) {
            throw new Error(`Failed to fetch embedding: ${error.response?.data?.error || error.message}`);
        }
    }
    async *lazyLoadVectors(options = {}) {
        const pageSize = options.pageSize || 200;
        let offset = options.offset || 0;
        if (!this.indexes || !this.indexes.primary) {
            throw new Error("Indexes are not initialized.");
        }
        const primary = Object.values(this.indexes.primary);
        while (offset < primary.length) {
            const batch = primary.slice(offset, offset + pageSize);
            for (const vector of batch) {
                yield vector;
            }
            offset += pageSize;
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
    calculateCosineSimilarity(vec1, vec2) {
        const dotProduct = lodash_1.default.sum(vec1.map((v, i) => v * vec2[i]));
        const magnitude1 = Math.sqrt(lodash_1.default.sum(vec1.map((v) => v * v)));
        const magnitude2 = Math.sqrt(lodash_1.default.sum(vec2.map((v) => v * v)));
        return dotProduct / (magnitude1 * magnitude2);
    }
    calculateEuclideanDistance(vec1, vec2) {
        return Math.sqrt(lodash_1.default.sum(vec1.map((v, i) => Math.pow(v - vec2[i], 2))));
    }
    calculateManhattanDistance(vec1, vec2) {
        return lodash_1.default.sum(vec1.map((v, i) => Math.abs(v - vec2[i])));
    }
    calculateMinkowskiDistance(vec1, vec2, p = 3) {
        return Math.pow(lodash_1.default.sum(vec1.map((v, i) => Math.pow(Math.abs(v - vec2[i]), p))), 1 / p);
    }
    calculateHammingDistance(vec1, vec2) {
        return vec1.reduce((acc, v, i) => acc + (v !== vec2[i] ? 1 : 0), 0);
    }
    calculatePearsonCorrelation(vec1, vec2) {
        const mean1 = lodash_1.default.mean(vec1);
        const mean2 = lodash_1.default.mean(vec2);
        const numerator = lodash_1.default.sum(vec1.map((v, i) => (v - mean1) * (vec2[i] - mean2)));
        const denominator = Math.sqrt(lodash_1.default.sum(vec1.map((v) => Math.pow(v - mean1, 2))) * lodash_1.default.sum(vec2.map((v) => Math.pow(v - mean2, 2))));
        return numerator / denominator;
    }
    calculateJaccardSimilarity(vec1, vec2) {
        const intersection = lodash_1.default.intersection(vec1, vec2).length;
        const union = lodash_1.default.union(vec1, vec2).length;
        return intersection / union;
    }
    async query(input) {
        if (!input.queryVector && !input.queryText) {
            throw new Error("Either 'queryVector' or 'queryText' must be provided.");
        }
        let queryVector = input.queryVector;
        if (!queryVector && input.queryText) {
            queryVector = await this.fetchEmbedding(input.queryText);
        }
        if (input.preprocessMethod) {
            queryVector = this.preprocessVector(queryVector, input.preprocessMethod);
        }
        if (input.reduceDimensionality) {
            const { reducedVectors } = this.reduceDimensionality([queryVector], input.reduceDimensionality.method || 'pca', input.targetDimension || 2);
            queryVector = reducedVectors[0];
        }
        const results = await this.findNearestNeighbors(queryVector, input.k || 5, input.method || "cosine", input.vectorKeyPath, input.sorting, input.radius, input.projection, input.metadataKeyPaths, input.data, input.pagination);
        if (input.similarityThreshold !== undefined) {
            return results.results.filter((result) => result.similarity >= (input.similarityThreshold ?? 0));
        }
        return results.results;
    }
    async findNearestNeighbors(queryVector, k = 5, method = "cosine", vectorKeyPath, sorting = 'desc', radius, projection, metadataKeyPaths, data, pagination) {
        const { pageSize = k, offset = 0 } = pagination || {};
        const paginatedVectors = this.lazyLoadVectors({ pageSize, offset });
        const similarityScores = [];
        for await (const vectorItem of paginatedVectors) {
            const vector = (0, recordPath_1.recordPath)(vectorItem, vectorKeyPath);
            if (!Array.isArray(vector)) {
                throw new Error("Invalid vector format or path.");
            }
            let similarity = this.calculateDistance(queryVector, vector, method);
            if (radius !== undefined && similarity > radius) {
                continue;
            }
            let metadata = {};
            if (metadataKeyPaths) {
                metadata = await this.fetchMetadata(vectorItem, metadataKeyPaths);
            }
            similarityScores.push({
                id: (0, recordPath_1.recordPath)(vectorItem, "UID"),
                similarity,
                metadata,
            });
        }
        const sortedResults = lodash_1.default.orderBy(similarityScores, "similarity", sorting);
        const projectedResults = projection
            ? sortedResults.map((result) => {
                const projectionObj = { similarity: result.similarity };
                projection.forEach((field) => {
                    projectionObj[field] = result[field];
                });
                return projectionObj;
            })
            : sortedResults;
        const totalResults = projectedResults.length;
        const paginatedResults = projectedResults.slice(0, pageSize);
        return {
            results: paginatedResults,
            total: totalResults,
            hasMore: offset + pageSize < totalResults,
            nextOffset: offset + pageSize,
        };
    }
    async fetchMetadata(item, metadataKeyPaths) {
        const metadata = {};
        for (const [key, path] of Object.entries(metadataKeyPaths)) {
            metadata[key] = await (0, recordPath_1.recordPath)(item, path);
        }
        return metadata;
    }
    preprocessVector(vector, method = 'standardize') {
        switch (method) {
            case 'normalize':
                return this.normalizeVector(vector);
            case 'standardize':
                return this.standardizeVector(vector);
            case 'robust':
                return this.robustPreprocessVector(vector);
            default:
                throw new Error(`Unsupported preprocessing method: ${method}`);
        }
    }
    normalizeVector(vector) {
        const magnitude = Math.sqrt(vector.reduce((acc, val) => acc + Math.pow(val, 2), 0));
        if (magnitude === 0)
            return vector;
        return vector.map(val => val / magnitude);
    }
    standardizeVector(vector) {
        const mean = vector.reduce((sum, val) => sum + val, 0) / vector.length;
        const variance = vector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vector.length;
        const stdDev = Math.sqrt(variance);
        return vector.map(val => (val - mean) / stdDev);
    }
    robustPreprocessVector(vector) {
        const sortedVector = [...vector].sort((a, b) => a - b);
        const median = this.median(sortedVector);
        const iqr = this.iqr(sortedVector);
        return vector.map(val => (val - median) / iqr);
    }
    median(sortedArray) {
        const mid = Math.floor(sortedArray.length / 2);
        return sortedArray.length % 2 === 0
            ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
            : sortedArray[mid];
    }
    iqr(sortedArray) {
        const q1 = sortedArray[Math.floor(sortedArray.length * 0.25)];
        const q3 = sortedArray[Math.floor(sortedArray.length * 0.75)];
        return q3 - q1;
    }
    clusterVectors(k, iterations = 100, method = "kmeans++", distanceMetric = "euclidean", preprocessMethod = "standardize") {
        if (!this.indexes || !this.indexes.primary) {
            throw new Error("Indexes are not initialized.");
        }
        const vectorRecords = Object.values(this.indexes.primary);
        if (k <= 0 || k > vectorRecords.length) {
            throw new Error("Invalid number of clusters.");
        }
        const vectors = vectorRecords.map((record) => record.vector);
        let centroids;
        if (method === "kmeans++") {
            centroids = this.initializeCentroidsKMeansPlusPlus(vectors, k);
        }
        else {
            centroids = lodash_1.default.sampleSize(vectors, k);
        }
        let clusters = new Map();
        let prevCentroids = [];
        let isConverged = false;
        for (let iter = 0; iter < iterations && !isConverged; iter++) {
            clusters.clear();
            vectorRecords.forEach((vectorData) => {
                let vector = vectorData.vector;
                if (preprocessMethod) {
                    vector = this.preprocessVector(vector, preprocessMethod);
                }
                const distances = centroids.map((centroid) => this.calculateDistance(vector, centroid, distanceMetric));
                const closestCentroidIndex = distances.indexOf(Math.min(...distances));
                if (!clusters.has(closestCentroidIndex)) {
                    clusters.set(closestCentroidIndex, []);
                }
                clusters.get(closestCentroidIndex)?.push(vectorData);
            });
            const newCentroids = this.recalculateCentroids(clusters);
            isConverged = this.checkConvergence(prevCentroids, newCentroids);
            prevCentroids = newCentroids;
            centroids = newCentroids;
        }
        return { centroids, clusters };
    }
    initializeCentroidsKMeansPlusPlus(vectors, k) {
        const centroids = [];
        centroids.push(lodash_1.default.sample(vectors.map((v) => v.vector)));
        while (centroids.length < k) {
            const distances = [];
            vectors.forEach((vectorData) => {
                const vector = vectorData.vector;
                const minDist = Math.min(...centroids.map((centroid) => this.calculateEuclideanDistance(vector, centroid)));
                distances.push(minDist);
            });
            const totalDistance = lodash_1.default.sum(distances);
            const probability = distances.map((dist) => dist / totalDistance);
            const selectedIndex = this.weightedRandomChoice(probability);
            centroids.push(vectors[selectedIndex].vector);
        }
        return centroids;
    }
    recalculateCentroids(clusters) {
        const centroids = [];
        clusters.forEach((cluster, index) => {
            if (cluster.length > 0) {
                const centroid = cluster[0].vector.map((_, dimensionIndex) => {
                    const dimensionValues = cluster.map((data) => data.vector[dimensionIndex]);
                    const sum = dimensionValues.reduce((acc, value) => acc + value, 0);
                    return sum / dimensionValues.length;
                });
                centroids.push(centroid);
            }
        });
        return centroids;
    }
    checkConvergence(prevCentroids, newCentroids) {
        return prevCentroids.every((prev, idx) => lodash_1.default.isEqual(prev, newCentroids[idx]));
    }
    weightedRandomChoice(probabilities) {
        const cumulativeSum = lodash_1.default.reduce(probabilities, (acc, p) => {
            acc.push((acc[acc.length - 1] || 0) + p);
            return acc;
        }, []);
        const rand = Math.random();
        return cumulativeSum.findIndex((sum) => sum >= rand);
    }
    calculateDistance(queryVector, vector, method) {
        let similarity;
        switch (method) {
            case "cosine":
                similarity = this.calculateCosineSimilarity(queryVector, vector);
                break;
            case "euclidean":
                similarity = -this.calculateEuclideanDistance(queryVector, vector);
                break;
            case "manhattan":
                similarity = -this.calculateManhattanDistance(queryVector, vector);
                break;
            case "minkowski":
                similarity = -this.calculateMinkowskiDistance(queryVector, vector);
                break;
            case "pearson":
                similarity = this.calculatePearsonCorrelation(queryVector, vector);
                break;
            case "jaccard":
                similarity = this.calculateJaccardSimilarity(queryVector, vector);
                break;
            case "hamming":
                similarity = -this.calculateHammingDistance(queryVector, vector);
                break;
            default:
                throw new Error(`Unsupported method: ${method}`);
        }
        return similarity;
    }
    reduceDimensionality(vectors, method = 'pca', targetDimension = 2, options = {}) {
        if (!Array.isArray(vectors) || vectors.length === 0) {
            throw new Error('Input vectors must be a non-empty array.');
        }
        if (method === 'pca') {
            const { reducedVectors, explainedVariance, reconstructedMatrix } = this.reduceUsingPCA(vectors, targetDimension);
            return { reducedVectors, explainedVariance, reconstructedMatrix };
        }
        else if (method === 'tsne') {
            return this.reduceUsingTSNE(vectors, targetDimension, options);
        }
        else if (method === 'umap') {
            return this.reduceUsingUMAP(vectors, targetDimension, options);
        }
        else {
            throw new Error(`Unsupported reduction method: ${method}`);
        }
    }
    reduceUsingPCA(vectors, targetDimension) {
        const matrix = new ml_matrix_1.Matrix(vectors);
        const svd = new ml_matrix_1.SingularValueDecomposition(matrix);
        const U = svd.leftSingularVectors;
        const S = svd.diagonalMatrix.to2DArray().map(row => row[0]);
        const V = svd.rightSingularVectors;
        const totalVariance = S.reduce((sum, val) => sum + val * val, 0);
        const explainedVariance = S.map(val => (val * val) / totalVariance);
        const reducedU = U.to2DArray().map(row => row.slice(0, targetDimension));
        const reducedS = S.slice(0, targetDimension);
        const reducedV = V.to2DArray().map(row => row.slice(0, targetDimension));
        const reconstructedMatrix = reducedU.map((uRow, i) => reducedS.map((s, j) => uRow[j] * s * reducedV[j][i]));
        return {
            reducedVectors: reducedU,
            explainedVariance,
            reconstructedMatrix,
        };
    }
    reduceUsingTSNE(vectors, targetDimension = 2, options = {}) {
        const { perplexity = 30, earlyExaggeration = 4.0, learningRate = 200.0, nIter = 1000, metric = 'euclidean' } = options;
        const tsneModel = new tsne({
            dim: targetDimension,
            perplexity,
            earlyExaggeration,
            learningRate,
            nIter,
            metric,
        });
        tsneModel.init({ data: vectors, type: 'dense' });
        tsneModel.run();
        const finalCost = tsneModel.getCost();
        return {
            reducedVectors: tsneModel.getOutput(),
            finalCost,
        };
    }
    reduceUsingUMAP(vectors, targetDimension = 2, options = {}) {
        const { nNeighbors = 15, minDist = 0.1, spread = 1.0, nEpochs = 200, learningRate = 1.0, localConnectivity = 1, negativeSampleRate = 5, repulsionStrength = 1, setOpMixRatio = 1.0, transformQueueSize = 4, } = options;
        const umapModel = new umap.UMAP({
            nNeighbors,
            minDist,
            spread,
            nComponents: targetDimension,
            nEpochs,
            learningRate,
            localConnectivity,
            negativeSampleRate,
            repulsionStrength,
            setOpMixRatio,
            transformQueueSize,
        });
        const reducedVectors = umapModel.fit(vectors);
        return { reducedVectors };
    }
    detectOutliers(options) {
        const { method = "zscore", threshold = 3, contamination = 0.1, k = 5 } = options;
        if (!this.indexes || !this.indexes.primary) {
            throw new Error("Indexes are not initialized.");
        }
        const vectorRecords = Object.values(this.indexes.primary);
        if (!vectorRecords.length) {
            throw new Error("No vectors available in the primary index.");
        }
        const flattenedVectors = vectorRecords.map((record) => record.vector);
        if (!flattenedVectors.every((vector) => Array.isArray(vector) && vector.every((val) => typeof val === "number"))) {
            throw new Error("Each vector must be an array of numbers.");
        }
        if (method === "zscore") {
            return this.detectOutliersZScore(vectorRecords, flattenedVectors, threshold);
        }
        else if (method === "iqr") {
            return this.detectOutliersIQR(vectorRecords, flattenedVectors);
        }
        else if (method === "lof") {
            return this.detectOutliersLOF(vectorRecords, flattenedVectors, k, threshold);
        }
        else if (method === "isolationForest") {
            return this.detectOutliersIsolationForest(vectorRecords, flattenedVectors, contamination);
        }
        else if (method === "oneClassSVM") {
            return this.detectOutliersOneClassSVM(vectorRecords, flattenedVectors, contamination);
        }
        throw new Error(`Outlier detection method '${method}' not implemented.`);
    }
    detectOutliersZScore(vectors, flattenedVectors, threshold) {
        const meanVector = flattenedVectors.reduce((acc, curr) => acc.map((val, i) => val + curr[i]), new Array(flattenedVectors[0].length).fill(0))
            .map((val) => val / flattenedVectors.length);
        const stdDevVector = flattenedVectors.reduce((acc, curr) => acc.map((val, i) => val + Math.pow(curr[i] - meanVector[i], 2)), new Array(flattenedVectors[0].length).fill(0))
            .map((val) => Math.sqrt(val / flattenedVectors.length));
        return vectors.filter((vectorData, index) => {
            const zScores = flattenedVectors[index].map((val, i) => Math.abs((val - meanVector[i]) / stdDevVector[i]));
            return zScores.some((score) => score > threshold);
        });
    }
    detectOutliersIQR(vectors, flattenedVectors) {
        const q1 = flattenedVectors.map(v => this.quantile(v, 0.25));
        const q3 = flattenedVectors.map(v => this.quantile(v, 0.75));
        const iqr = q3.map((q, i) => q - q1[i]);
        return vectors.filter((vectorData, index) => {
            const isOutlier = flattenedVectors[index].some((val, i) => {
                const lowerBound = q1[i] - 1.5 * iqr[i];
                const upperBound = q3[i] + 1.5 * iqr[i];
                return val < lowerBound || val > upperBound;
            });
            return isOutlier;
        });
    }
    detectOutliersIsolationForest(vectors, flattenedVectors, contamination = 0.1) {
        const isolationScores = flattenedVectors.map(() => Math.random());
        const sortedScores = [...isolationScores].sort((a, b) => a - b);
        const thresholdIndex = Math.floor(contamination * flattenedVectors.length);
        const threshold = sortedScores[thresholdIndex];
        return vectors.filter((_, index) => isolationScores[index] > threshold);
    }
    detectOutliersLOF(vectors, flattenedVectors, k = 5, threshold = 1.5) {
        const lofScores = [];
        const distances = flattenedVectors.map((vector, index) => {
            return flattenedVectors.map((otherVector) => this.calculateEuclideanDistance(vector, otherVector));
        });
        const reachabilityDistances = distances.map((dist, i) => {
            const sortedDist = [...dist].sort((a, b) => a - b);
            const kthDistance = sortedDist[k];
            return dist.map((d) => Math.max(d, kthDistance));
        });
        const localDensities = reachabilityDistances.map((reachDist, i) => {
            return reachDist.reduce((sum, d) => sum + d, 0) / reachDist.length;
        });
        for (let i = 0; i < flattenedVectors.length; i++) {
            const lrd = localDensities[i];
            const lrdRatios = distances[i].map((dist, j) => {
                const reachability = reachabilityDistances[i][j];
                return reachability / localDensities[j];
            });
            const lof = lrdRatios.reduce((sum, ratio) => sum + ratio, 0) / k;
            lofScores.push(lof);
        }
        return vectors.filter((_, index) => lofScores[index] > threshold);
    }
    detectOutliersOneClassSVM(vectors, flattenedVectors, contamination = 0.1) {
        const mean = flattenedVectors[0].map((_, idx) => flattenedVectors.map((vector) => vector[idx]).reduce((sum, val) => sum + val, 0) / flattenedVectors.length);
        const distances = flattenedVectors.map((vector) => this.calculateEuclideanDistance(vector, mean));
        const thresholdIndex = Math.floor(contamination * flattenedVectors.length);
        const sortedDistances = [...distances].sort((a, b) => a - b);
        const threshold = sortedDistances[thresholdIndex];
        return vectors.filter((_, index) => distances[index] > threshold);
    }
    quantile(arr, percentile) {
        const sortedArr = [...arr].sort((a, b) => a - b);
        const index = Math.floor(percentile * (sortedArr.length - 1));
        return sortedArr[index];
    }
    async ensembleVectorQuery(queries) {
        const ensembleResults = new Map();
        for (const query of queries) {
            const { queryVector, method = "cosine", weight = 1, k = 5, vectorKeyPath = "vector", sorting = "desc", radius, reduceDimensionality, preprocessMethod, projection, metadataKeyPaths, pagination, } = query;
            let processedQueryVector = queryVector;
            if (preprocessMethod) {
                processedQueryVector = this.preprocessVector(queryVector, preprocessMethod);
            }
            if (reduceDimensionality) {
                const { reducedVectors } = this.reduceDimensionality([processedQueryVector], reduceDimensionality.method || "pca", reduceDimensionality.targetDimension || 2, reduceDimensionality.options || {});
                processedQueryVector = reducedVectors[0];
            }
            const results = await this.findNearestNeighbors(processedQueryVector, k, method, vectorKeyPath, sorting, radius, projection, metadataKeyPaths, undefined, pagination);
            const filteredResults = radius !== undefined
                ? results.results.filter(result => Math.abs(result.similarity) <= radius)
                : results.results;
            filteredResults.forEach(result => {
                const currentScore = ensembleResults.get(result.id) || 0;
                ensembleResults.set(result.id, currentScore + (result.similarity * weight));
            });
        }
        return Array.from(ensembleResults.entries())
            .map(([id, score]) => ({ id, ensembleScore: score }))
            .sort((a, b) => b.ensembleScore - a.ensembleScore)
            .slice(0, 5);
    }
}
exports.default = nuv_vector;
//# sourceMappingURL=vectors.js.map
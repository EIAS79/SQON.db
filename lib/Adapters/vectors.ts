import _ from "lodash";
import { recordPath } from "../Functions/recordPath";
import axios from "axios";
import Logger from "../Functions/loggers";
import { Matrix, SingularValueDecomposition } from 'ml-matrix';
const tsne: any = require('tsne-js');
import * as umap from 'umap-js';
import { Index } from "../Types/query";

export interface VectorData {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
  data: any;
}

interface PaginationOptions {
  pageSize?: number;
  offset?: number;
}

interface SearchResult<T> {
  results: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export default class nuv_vector<T extends VectorData> {
  public logger: Logger;
  public indexes: Index | null = null;

  constructor(indexes: Index | null ) {
    this.logger = new Logger();
    this.indexes = indexes;
  }

  private embeddingCache: Map<string, number[]> = new Map();

  public async fetchEmbedding(text: string): Promise<number[]> {
    try {
      if (this.embeddingCache.has(text)) {
        return this.embeddingCache.get(text)!;
      }
      const response = await axios.post(
        `https://api.electronhub.top/v1/embeddings`,
        {
          model: "text-embedding-3-large",
          input: text,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ek-am4V5cXBlrCvRx7Ts3TXmvki5CTP3HZst4bNAbyH0XSkzmOqG1`,
          },
        }
      );

      const embedding = response.data.data[0].embedding;

      this.embeddingCache.set(text, embedding);

      return embedding;
    } catch (error: any) {
      throw new Error(`Failed to fetch embedding: ${error.response?.data?.error || error.message}`);
    }
  }
  
  public async *lazyLoadVectors(options: PaginationOptions = {}): AsyncGenerator<any> {
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

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = _.sum(vec1.map((v, i) => v * vec2[i]));
    const magnitude1 = Math.sqrt(_.sum(vec1.map((v) => v * v)));
    const magnitude2 = Math.sqrt(_.sum(vec2.map((v) => v * v)));
    return dotProduct / (magnitude1 * magnitude2);
  }

  private calculateEuclideanDistance(vec1: number[], vec2: number[]): number {
    return Math.sqrt(_.sum(vec1.map((v, i) => Math.pow(v - vec2[i], 2))));
  }

  private calculateManhattanDistance(vec1: number[], vec2: number[]): number {
    return _.sum(vec1.map((v, i) => Math.abs(v - vec2[i])));
  }

  private calculateMinkowskiDistance(vec1: number[], vec2: number[], p: number = 3): number {
    return Math.pow(_.sum(vec1.map((v, i) => Math.pow(Math.abs(v - vec2[i]), p))), 1 / p);
  }

  private calculateHammingDistance(vec1: number[], vec2: number[]): number {
    return vec1.reduce((acc, v, i) => acc + (v !== vec2[i] ? 1 : 0), 0);
  }

  private calculatePearsonCorrelation(vec1: number[], vec2: number[]): number {
    const mean1 = _.mean(vec1);
    const mean2 = _.mean(vec2);
    const numerator = _.sum(vec1.map((v, i) => (v - mean1) * (vec2[i] - mean2)));
    const denominator = Math.sqrt(
      _.sum(vec1.map((v) => Math.pow(v - mean1, 2))) * _.sum(vec2.map((v) => Math.pow(v - mean2, 2)))
    );
    return numerator / denominator;
  }

  private calculateJaccardSimilarity(vec1: number[], vec2: number[]): number {
    const intersection = _.intersection(vec1, vec2).length;
    const union = _.union(vec1, vec2).length;
    return intersection / union;
  }

  async query(input: { 
    queryVector?: number[]; 
    queryText?: string; 
    vectorKeyPath: string; 
    similarityThreshold?: number; 
    metadataKeyPaths?: Record<string, string>; 
    k?: number;
    radius?: number,
    sorting?: 'asc' | 'desc';
    method?: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming"; 
    projection?: (keyof T)[]; 
    data?: any[]; 
    pagination?: PaginationOptions; 
    reduceDimensionality?: {
    method?: "pca" | "tsne"
    }; 
    targetDimension?: number; 
    preprocessMethod?: 'normalize' | 'standardize' | 'robust';
  }): Promise<any[]> {
    if (!input.queryVector && !input.queryText) {
      throw new Error("Either 'queryVector' or 'queryText' must be provided.");
    }
  
    let queryVector = input.queryVector;
  
    if (!queryVector && input.queryText) {
      queryVector = await this.fetchEmbedding(input.queryText);
    }
  
    if (input.preprocessMethod) {
      queryVector = this.preprocessVector(queryVector as number[], input.preprocessMethod);
    }
  
    if (input.reduceDimensionality) {
      const { reducedVectors } = this.reduceDimensionality(
        [queryVector as number[]], 
        input.reduceDimensionality.method || 'pca', 
        input.targetDimension || 2
      );
      queryVector = reducedVectors[0];
    }
  
    const results = await this.findNearestNeighbors(
      queryVector!,
      input.k || 5,
      input.method || "cosine",
      input.vectorKeyPath,
      input.sorting,
      input.radius,
      input.projection,
      input.metadataKeyPaths,
      input.data,
      input.pagination
    );
  
    if (input.similarityThreshold !== undefined) {
      return results.results.filter((result) => result.similarity >= (input.similarityThreshold ?? 0));
    }
  
    return results.results;
  }
  
  async findNearestNeighbors(
    queryVector: number[],
    k: number = 5,
    method: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming" = "cosine",
    vectorKeyPath: string,
    sorting: 'asc' | 'desc' = 'desc',
    radius?: number,
    projection?: (keyof T)[],
    metadataKeyPaths?: Record<string, string>,
    data?: any[],
    pagination?: PaginationOptions
  ): Promise<SearchResult<any>> {
  
    const { pageSize = k, offset = 0 } = pagination || {};
    const paginatedVectors = this.lazyLoadVectors({ pageSize, offset });
  
    const similarityScores: any[] = [];
    for await (const vectorItem of paginatedVectors) {
      const vector: number[] = recordPath(vectorItem, vectorKeyPath);
      if (!Array.isArray(vector)) {
        throw new Error("Invalid vector format or path.");
      }
  
      let similarity = this.calculateDistance(queryVector, vector, method);
  
      if (radius !== undefined && similarity > radius) {
        continue;
      }
  
      let metadata: Record<string, any> = {};
      if (metadataKeyPaths) {
        metadata = await this.fetchMetadata(vectorItem, metadataKeyPaths);
      }
  
      similarityScores.push({
        id: recordPath(vectorItem, "UID"),
        similarity,
        metadata,
      });
    }
  
    const sortedResults = _.orderBy(similarityScores, "similarity", sorting);
  
    const projectedResults = projection
      ? sortedResults.map((result) => {
          const projectionObj: any = { similarity: result.similarity };
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
        
  async fetchMetadata(item: any, metadataKeyPaths: Record<string, string>): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};
    for (const [key, path] of Object.entries(metadataKeyPaths)) {
      metadata[key] = await recordPath(item, path);
    }
    return metadata;
  }

  private preprocessVector(vector: number[], method: 'normalize' | 'standardize' | 'robust' = 'standardize'): number[] {
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
  
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((acc, val) => acc + Math.pow(val, 2), 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }
  
  private standardizeVector(vector: number[]): number[] {
    const mean = vector.reduce((sum, val) => sum + val, 0) / vector.length;
    const variance = vector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vector.length;
    const stdDev = Math.sqrt(variance);
    return vector.map(val => (val - mean) / stdDev);
  }
  
  private robustPreprocessVector(vector: number[]): number[] {
    const sortedVector = [...vector].sort((a, b) => a - b);
    const median = this.median(sortedVector);
    const iqr = this.iqr(sortedVector);
    return vector.map(val => (val - median) / iqr);
  }
  
  private median(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }
  
  private iqr(sortedArray: number[]): number {
    const q1 = sortedArray[Math.floor(sortedArray.length * 0.25)];
    const q3 = sortedArray[Math.floor(sortedArray.length * 0.75)];
    return q3 - q1;
  }
  

  clusterVectors(
    k: number,
    iterations: number = 100,
    method: "kmeans++" | "random" = "kmeans++",
    distanceMetric: "euclidean" | "cosine" | "manhattan" = "euclidean",
    preprocessMethod: "normalize" | "standardize" | "robust" = "standardize"
  ): { centroids: number[][]; clusters: Map<number, T[]> } {
    if (!this.indexes || !this.indexes.primary) {
      throw new Error("Indexes are not initialized.");
    }
  
    const vectorRecords = Object.values(this.indexes.primary); 
    if (k <= 0 || k > vectorRecords.length) {
      throw new Error("Invalid number of clusters.");
    }
  
    const vectors = vectorRecords.map((record) => record.vector);
    let centroids: number[][];
  
    if (method === "kmeans++") {
      centroids = this.initializeCentroidsKMeansPlusPlus(vectors, k);
    } else {
      centroids = _.sampleSize(vectors, k);
    }
  
    let clusters: Map<number, T[]> = new Map();
    let prevCentroids: number[][] = [];
    let isConverged = false;
  
    for (let iter = 0; iter < iterations && !isConverged; iter++) {
      clusters.clear();
  
      vectorRecords.forEach((vectorData) => {
        let vector = vectorData.vector;
  
        if (preprocessMethod) {
          vector = this.preprocessVector(vector, preprocessMethod);
        }
  
        const distances = centroids.map((centroid) =>
          this.calculateDistance(vector, centroid, distanceMetric)
        );
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
  
  private initializeCentroidsKMeansPlusPlus(vectors: T[], k: number): number[][] {
    const centroids: number[][] = [];
    centroids.push(_.sample(vectors.map((v) => v.vector))!);
    
    while (centroids.length < k) {
      const distances: number[] = [];
      vectors.forEach((vectorData) => {
        const vector = vectorData.vector;
        const minDist = Math.min(...centroids.map((centroid) => this.calculateEuclideanDistance(vector, centroid)));
        distances.push(minDist);
      });
      const totalDistance = _.sum(distances);
      const probability = distances.map((dist) => dist / totalDistance);
      const selectedIndex = this.weightedRandomChoice(probability);
      centroids.push(vectors[selectedIndex].vector);
    }

    return centroids;
  }
  private recalculateCentroids(clusters: Map<number, T[]>): number[][] {
    const centroids: number[][] = [];
  
    clusters.forEach((cluster, index) => {
      if (cluster.length > 0) {
        const centroid: number[] = cluster[0].vector.map((_, dimensionIndex) => {
          const dimensionValues = cluster.map((data) => data.vector[dimensionIndex]);
          const sum = dimensionValues.reduce((acc, value) => acc + value, 0);
          return sum / dimensionValues.length;
        });
  
        centroids.push(centroid); 
      }
    });
  
    return centroids;
  }
  

  private checkConvergence(prevCentroids: number[][], newCentroids: number[][]): boolean {
    return prevCentroids.every((prev, idx) => 
      _.isEqual(prev, newCentroids[idx])
    );
  }

  private weightedRandomChoice(probabilities: number[]): number {
    const cumulativeSum = _.reduce(probabilities, (acc, p) => {
      acc.push((acc[acc.length - 1] || 0) + p);
      return acc;
    }, [] as number[]);
    const rand = Math.random();
    return cumulativeSum.findIndex((sum) => sum >= rand);
  }

  private calculateDistance(
    queryVector: number[], 
    vector: number[], 
    method: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming"
  ): number {
    let similarity: number;

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

  reduceDimensionality(
    vectors: number[][],
    method: 'pca' | 'tsne' | 'umap' = 'pca',
    targetDimension: number = 2,
    options: { [key: string]: any } = {}
  ): { reducedVectors: number[][]; explainedVariance?: number[]; reconstructedMatrix?: number[][]; finalCost?: number } {
    if (!Array.isArray(vectors) || vectors.length === 0) {
      throw new Error('Input vectors must be a non-empty array.');
    }
  
    if (method === 'pca') {
      const { reducedVectors, explainedVariance, reconstructedMatrix } = this.reduceUsingPCA(vectors, targetDimension);
      return { reducedVectors, explainedVariance, reconstructedMatrix };
    } else if (method === 'tsne') {
      return this.reduceUsingTSNE(vectors, targetDimension, options);
    } else if (method === 'umap') {
      return this.reduceUsingUMAP(vectors, targetDimension, options);
    } else {
      throw new Error(`Unsupported reduction method: ${method}`);
    }
  }
  
  private reduceUsingPCA(vectors: number[][], targetDimension: number): { 
    reducedVectors: number[][]; 
    explainedVariance: number[]; 
    reconstructedMatrix?: number[][];
  } {
    const matrix = new Matrix(vectors);
    const svd = new SingularValueDecomposition(matrix);
  
    const U = svd.leftSingularVectors;
    const S = svd.diagonalMatrix.to2DArray().map(row => row[0]);
    const V = svd.rightSingularVectors;
  
    const totalVariance = S.reduce((sum, val) => sum + val * val, 0);
    const explainedVariance = S.map(val => (val * val) / totalVariance);
  
    const reducedU = U.to2DArray().map(row => row.slice(0, targetDimension));
    const reducedS = S.slice(0, targetDimension);
    const reducedV = V.to2DArray().map(row => row.slice(0, targetDimension));
  
    const reconstructedMatrix = reducedU.map((uRow, i) => 
      reducedS.map((s, j) => uRow[j] * s * reducedV[j][i])
    );
  
    return {
      reducedVectors: reducedU,
      explainedVariance,
      reconstructedMatrix,
    };
  }
  
  private reduceUsingTSNE(
    vectors: number[][],
    targetDimension: number = 2,
    options: { 
      perplexity?: number; 
      earlyExaggeration?: number; 
      learningRate?: number; 
      nIter?: number; 
      metric?: 'euclidean' | 'cosine' 
    } = {}
  ): { reducedVectors: number[][]; finalCost: number } {
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
  
  private reduceUsingUMAP(
    vectors: number[][],
    targetDimension: number = 2,
    options: { 
      nNeighbors?: number; 
      minDist?: number; 
      spread?: number; 
      nEpochs?: number; 
      learningRate?: number; 
      localConnectivity?: number; 
      negativeSampleRate?: number; 
      repulsionStrength?: number; 
      setOpMixRatio?: number; 
      transformQueueSize?: number;
    } = {}
  ): { reducedVectors: number[][] } {
    const {
      nNeighbors = 15,
      minDist = 0.1,
      spread = 1.0,
      nEpochs = 200,
      learningRate = 1.0,
      localConnectivity = 1,
      negativeSampleRate = 5,
      repulsionStrength = 1,
      setOpMixRatio = 1.0,
      transformQueueSize = 4,
    } = options;
  
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
  

  detectOutliers(options: {
    method?: "zscore" | "iqr" | "lof" | "isolationForest" | "oneClassSVM";
    threshold?: number;
    contamination?: number;
    k?: number;
  }): T[] {
    const { method = "zscore", threshold = 3, contamination = 0.1, k = 5 } = options;
  
    if (!this.indexes || !this.indexes.primary) {
      throw new Error("Indexes are not initialized.");
    }
  
    const vectorRecords = Object.values(this.indexes.primary);
    if (!vectorRecords.length) {
      throw new Error("No vectors available in the primary index.");
    }
  
    const flattenedVectors = vectorRecords.map((record) => record.vector);
    if (
      !flattenedVectors.every(
        (vector) => Array.isArray(vector) && vector.every((val) => typeof val === "number")
      )
    ) {
      throw new Error("Each vector must be an array of numbers.");
    }
  
    if (method === "zscore") {
      return this.detectOutliersZScore(vectorRecords, flattenedVectors, threshold);
    } else if (method === "iqr") {
      return this.detectOutliersIQR(vectorRecords, flattenedVectors);
    } else if (method === "lof") {
      return this.detectOutliersLOF(vectorRecords, flattenedVectors, k, threshold);
    } else if (method === "isolationForest") {
      return this.detectOutliersIsolationForest(vectorRecords, flattenedVectors, contamination);
    } else if (method === "oneClassSVM") {
      return this.detectOutliersOneClassSVM(vectorRecords, flattenedVectors, contamination);
    }
  
    throw new Error(`Outlier detection method '${method}' not implemented.`);
  }
  
private detectOutliersZScore(vectors: T[], flattenedVectors: number[][], threshold: number): T[] {
    const meanVector = flattenedVectors.reduce((acc, curr) => 
        acc.map((val, i) => val + curr[i]), new Array(flattenedVectors[0].length).fill(0))
        .map((val) => val / flattenedVectors.length);

    const stdDevVector = flattenedVectors.reduce((acc, curr) => 
        acc.map((val, i) => val + Math.pow(curr[i] - meanVector[i], 2)), 
        new Array(flattenedVectors[0].length).fill(0))
        .map((val) => Math.sqrt(val / flattenedVectors.length));

    return vectors.filter((vectorData, index) => {
        const zScores = flattenedVectors[index].map((val, i) => 
            Math.abs((val - meanVector[i]) / stdDevVector[i])
        );
        return zScores.some((score) => score > threshold); 
    });
}

private detectOutliersIQR(vectors: T[], flattenedVectors: number[][]): T[] {
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

private detectOutliersIsolationForest(vectors: T[], flattenedVectors: number[][], contamination: number = 0.1): T[] {
    const isolationScores = flattenedVectors.map(() => Math.random()); 
    
    const sortedScores = [...isolationScores].sort((a, b) => a - b);
    const thresholdIndex = Math.floor(contamination * flattenedVectors.length);
    const threshold = sortedScores[thresholdIndex];

    return vectors.filter((_, index) => isolationScores[index] > threshold);
}

private detectOutliersLOF(vectors: T[], flattenedVectors: number[][], k: number = 5, threshold: number = 1.5): T[] {
    const lofScores: number[] = [];
  
    const distances = flattenedVectors.map((vector, index) => {
        return flattenedVectors.map((otherVector) => this.calculateEuclideanDistance(vector, otherVector));
    });

    const reachabilityDistances: number[][] = distances.map((dist, i) => {
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

private detectOutliersOneClassSVM(vectors: T[], flattenedVectors: number[][], contamination: number = 0.1): T[] {
    const mean = flattenedVectors[0].map((_, idx) => flattenedVectors.map((vector) => vector[idx]).reduce((sum, val) => sum + val, 0) / flattenedVectors.length);
    const distances = flattenedVectors.map((vector) => this.calculateEuclideanDistance(vector, mean));
    
    const thresholdIndex = Math.floor(contamination * flattenedVectors.length);
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const threshold = sortedDistances[thresholdIndex];

    return vectors.filter((_, index) => distances[index] > threshold);
}

private quantile(arr: number[], percentile: number): number {
    const sortedArr = [...arr].sort((a, b) => a - b);
    const index = Math.floor(percentile * (sortedArr.length - 1));
    return sortedArr[index];
}

async ensembleVectorQuery(queries: {
  queryVector: number[];
  method?: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming";
  weight?: number;
  k?: number;
  vectorKeyPath?: string;
  sorting?: "asc" | "desc";
  radius?: number;
  reduceDimensionality?: {
    method?: "pca" | "tsne" | "umap";
    targetDimension?: number;
    options?: { [key: string]: any };
  };
  preprocessMethod?: "normalize" | "standardize" | "robust"; 
  projection?: (keyof T)[];
  metadataKeyPaths?: Record<string, string>;
  pagination?: PaginationOptions;
}[]): Promise<any[]> {
  const ensembleResults: Map<string, number> = new Map();

  for (const query of queries) {
    const {
      queryVector,
      method = "cosine",
      weight = 1,
      k = 5,
      vectorKeyPath = "vector",
      sorting = "desc",
      radius,
      reduceDimensionality,
      preprocessMethod,
      projection,
      metadataKeyPaths,
      pagination,
    } = query;

    let processedQueryVector = queryVector;

    if (preprocessMethod) {
      processedQueryVector = this.preprocessVector(queryVector, preprocessMethod);
    }

    if (reduceDimensionality) {
      const { reducedVectors } = this.reduceDimensionality(
        [processedQueryVector],
        reduceDimensionality.method || "pca",
        reduceDimensionality.targetDimension || 2,
        reduceDimensionality.options || {}
      );
      processedQueryVector = reducedVectors[0];
    }

    const results = await this.findNearestNeighbors(
      processedQueryVector,
      k,
      method,
      vectorKeyPath,
      sorting,
      radius,
      projection,
      metadataKeyPaths,
      undefined,
      pagination
    );

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
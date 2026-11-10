export interface Product {
  id: string;
  name: string;
  stock: number;
  sales: number;
}

export interface RecommendationResponse {
  recommendations: {
    id: string;
    title: string;
    type: string;
    priority: string;
    financialImpact: {
      type: string;
      amount: number;
      currency: string;
    };
    description: string;
    affectedProducts: {
      productId: string;
      name: string;
      currentStock: number;
      recommendedStock: number;
    }[];
    deadline: string;
  }[];
}

// OpenAI Configuration Types
export interface OpenAIConfig {
  apiKey: string;
  organization: string;
  project: string;
}

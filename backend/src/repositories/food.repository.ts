import { pool } from "../config/database";
import { Food } from "../interfaces/food.interface";
import { CreateFoodData } from "../interfaces/create-food-data.interface";
import { CreateFood } from "../interfaces/create-food.interface";

export class FoodRepository {
  public async findAllByUserId(userId: number): Promise<Food[]> {
    const result = await pool.query(
      `
            SELECT
                id,
                user_id AS "userId",
                name,
                category,
                quantity::float AS quantity,
                unit,
                storage_location AS "storageLocation",
                to_char(expiration_date, 'YYYY-MM-DD') AS "expirationDate",
                created_at AS "createdAt"
            FROM foods
            WHERE user_id = $1
            ORDER BY expiration_date ASC
            `,
      [userId],
    );

    return result.rows;
  }

  public async findById(id: number, userId: number): Promise<Food | null> {
    const result = await pool.query(
      `
            SELECT
                id,
                user_id AS "userId",
                name,
                category,
                quantity::float AS quantity,
                unit,
                storage_location AS "storageLocation",
                to_char(expiration_date, 'YYYY-MM-DD') AS "expirationDate",
                created_at AS "createdAt"
            FROM foods
            WHERE id = $1
              AND user_id = $2
            `,
      [id, userId],
    );

    return result.rows[0] ?? null;
  }

  public async create(food: CreateFoodData): Promise<Food> {
    const result = await pool.query(
      `
            INSERT INTO foods (
                user_id,
                name,
                category,
                quantity,
                unit,
                storage_location,
                expiration_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id,
                user_id AS "userId",
                name,
                category,
                quantity::float AS quantity,
                unit,
                storage_location AS "storageLocation",
                to_char(expiration_date, 'YYYY-MM-DD') AS "expirationDate",
                created_at AS "createdAt"
            `,
      [
        food.userId,
        food.name,
        food.category,
        food.quantity,
        food.unit,
        food.storageLocation,
        food.expirationDate,
      ],
    );

    return result.rows[0];
  }

  public async update(
    id: number,
    userId: number,
    food: CreateFood,
  ): Promise<Food | null> {
    const result = await pool.query(
      `
            UPDATE foods
            SET
                name = $1,
                category = $2,
                quantity = $3,
                unit = $4,
                storage_location = $5,
                expiration_date = $6
            WHERE id = $7
              AND user_id = $8
            RETURNING
                id,
                user_id AS "userId",
                name,
                category,
                quantity::float AS quantity,
                unit,
                storage_location AS "storageLocation",
                to_char(expiration_date, 'YYYY-MM-DD') AS "expirationDate",
                created_at AS "createdAt"
            `,
      [
        food.name,
        food.category,
        food.quantity,
        food.unit,
        food.storageLocation,
        food.expirationDate,
        id,
        userId,
      ],
    );

    return result.rows[0] ?? null;
  }

  public async delete(id: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      `
            DELETE FROM foods
            WHERE id = $1
              AND user_id = $2
            `,
      [id, userId],
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  public async findExpiringByUserId(userId: number): Promise<Food[]> {
    const result = await pool.query(
      `
            SELECT
                id,
                user_id AS "userId",
                name,
                category,
                quantity::float AS quantity,
                unit,
                storage_location AS "storageLocation",
                to_char(expiration_date, 'YYYY-MM-DD') AS "expirationDate",
                created_at AS "createdAt"
            FROM foods
            WHERE user_id = $1
              AND quantity > 0
              AND expiration_date <= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + INTERVAL '7 days'
            ORDER BY expiration_date ASC
            `,
      [userId],
    );

    return result.rows;
  }
}

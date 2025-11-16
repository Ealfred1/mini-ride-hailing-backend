import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE TYPE "public"."drivers_status_enum" AS ENUM('available','busy')`);
    await queryRunner.query(`CREATE TABLE "drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "status" "public"."drivers_status_enum" NOT NULL DEFAULT 'available', "location" geography(Point,4326) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_drivers_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_drivers_name" ON "drivers" ("name")`);
    await queryRunner.query(`CREATE INDEX "IDX_drivers_status" ON "drivers" ("status")`);

    await queryRunner.query(`CREATE TYPE "public"."rides_status_enum" AS ENUM('pending','assigned','accepted','completed','cancelled')`);
    await queryRunner.query(`CREATE TABLE "rides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying(120) NOT NULL, "pickup_lat" numeric(10,7) NOT NULL, "pickup_lng" numeric(10,7) NOT NULL, "pickup_address" character varying(255) NOT NULL, "destination_lat" numeric(10,7) NOT NULL, "destination_lng" numeric(10,7) NOT NULL, "destination_address" character varying(255) NOT NULL, "status" "public"."rides_status_enum" NOT NULL DEFAULT 'pending', "driver_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_rides_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_rides_user_id" ON "rides" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_rides_status" ON "rides" ("status")`);
    await queryRunner.query(`ALTER TABLE "rides" ADD CONSTRAINT "FK_rides_driver" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rides" DROP CONSTRAINT "FK_rides_driver"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rides_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rides_user_id"`);
    await queryRunner.query(`DROP TABLE "rides"`);
    await queryRunner.query(`DROP TYPE "public"."rides_status_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_drivers_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_drivers_name"`);
    await queryRunner.query(`DROP TABLE "drivers"`);
    await queryRunner.query(`DROP TYPE "public"."drivers_status_enum"`);
  }
}


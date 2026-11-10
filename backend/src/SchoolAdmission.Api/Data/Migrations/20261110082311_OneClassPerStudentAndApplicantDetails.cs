using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OneClassPerStudentAndApplicantDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_holds_one_active_per_student_class",
                table: "holds");

            migrationBuilder.AddColumn<string>(
                name: "contact_number",
                table: "holds",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "student_age",
                table: "holds",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "student_name",
                table: "holds",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            // Existing data may break "one class per student". Settle expired holds, then keep each
            // student's confirmed admission (or else their earliest live hold) and cancel the rest,
            // so the unique index below can be built.
            migrationBuilder.Sql("""
                UPDATE holds SET status = 'EXPIRED'
                WHERE status = 'HELD' AND expires_at <= now();

                UPDATE holds SET status = 'CANCELLED', cancelled_at = now()
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id, row_number() OVER (
                            PARTITION BY student_id
                            ORDER BY (status = 'CONFIRMED') DESC, created_at) AS rank
                        FROM holds
                        WHERE status IN ('HELD', 'CONFIRMED')) ranked
                    WHERE rank > 1);
                """);

            migrationBuilder.CreateIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds",
                column: "student_id",
                unique: true,
                filter: "status IN ('HELD', 'CONFIRMED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_holds_one_active_per_student",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "contact_number",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "student_age",
                table: "holds");

            migrationBuilder.DropColumn(
                name: "student_name",
                table: "holds");

            migrationBuilder.CreateIndex(
                name: "ux_holds_one_active_per_student_class",
                table: "holds",
                columns: new[] { "class_id", "student_id" },
                unique: true,
                filter: "status IN ('HELD', 'CONFIRMED')");
        }
    }
}

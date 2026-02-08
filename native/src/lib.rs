use napi_derive::napi;

#[napi]
pub fn calculate_kpi_growth(current: f64, previous: f64) -> f64 {
    if previous == 0.0 {
        return 0.0;
    }
    ((current - previous) / previous) * 100.0
}
